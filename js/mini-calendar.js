/* mini-calendar.js - small month calendar for the rail (plain ES5, no dependencies).
 * MiniCalendar(element, {firstDay: 1})  firstDay: 0 = Sunday first, 1 = Monday first (default); week numbers are ISO 8601 either way.
 * Month / year selects, previous / next month, Today, click or keyboard to select a day (visual only), today refreshed after midnight.
 */
(function (global) {
	'use strict';
	var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	var DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	var YEAR_MIN = 1970, YEAR_MAX = 2100;

	function pad(n) { return (n < 10 ? '0' : '') + n; }
	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }
	function key(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
	/* ISO 8601 week number of a calendar date (UTC arithmetic: no daylight-saving effects) */
	function isoWeek(y, m, d) {
		var t = new Date(Date.UTC(y, m, d));
		t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));                 // the Thursday of this ISO week
		var jan1 = Date.UTC(t.getUTCFullYear(), 0, 1);
		return Math.ceil(((t.getTime() - jan1) / 864e5 + 1) / 7);
	}

	function MiniCalendar(root, opts) {
		opts = opts || {};
		var first = opts.firstDay === 0 ? 0 : 1;
		var now = new Date();
		var today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
		var view = { y: today.y, m: today.m };
		var sel = { y: today.y, m: today.m, d: today.d };      // like before: today is selected at the start ...
		var picked = false;                                     // ... and keeps following "today" until the visitor picks another day
		var focus = { y: today.y, m: today.m, d: today.d };
		var midnight = null;

		root.className += ' cal';
		root.setAttribute('role', 'group');
		root.setAttribute('aria-label', 'Calendar');

		/* header: month + year selects, previous / next month */
		var head = el('div', 'cal-head');
		var selM = el('select', 'cal-month'); selM.setAttribute('aria-label', 'Month');
		MONTHS.forEach(function (n, i) { var o = el('option', '', n); o.value = i; selM.appendChild(o); });
		var selY = el('select', 'cal-year'); selY.setAttribute('aria-label', 'Year');
		for (var y = YEAR_MIN; y <= YEAR_MAX; y++) { var oy = el('option', '', y); oy.value = y; selY.appendChild(oy); }
		var prev = el('button', 'cal-nav', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous month'); prev.title = 'Previous month';
		var next = el('button', 'cal-nav', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next month'); next.title = 'Next month';
		head.appendChild(selM); head.appendChild(selY); head.appendChild(prev); head.appendChild(next);

		/* grid: week-number column + 7 day columns, always 6 rows (the height never jumps) */
		var table = el('table', 'cal-grid'); table.setAttribute('role', 'grid');
		var thead = el('thead'), hr = el('tr');
		var wk = el('th', 'wn', 'wk'); wk.scope = 'col'; wk.title = 'ISO week number'; hr.appendChild(wk);
		for (var i = 0; i < 7; i++) {
			var wd = (first + i) % 7, th = el('th', (wd === 0 || wd === 6) ? 'we' : '', DAYS[wd]);
			th.scope = 'col'; th.abbr = DAYS_LONG[wd]; hr.appendChild(th);
		}
		thead.appendChild(hr); table.appendChild(thead);
		var tbody = el('tbody'); table.appendChild(tbody);

		var foot = el('div', 'cal-foot');
		var todayBtn = el('button', 'cal-today', 'Today'); todayBtn.type = 'button'; todayBtn.title = 'Go to today';
		foot.appendChild(todayBtn);

		root.appendChild(head); root.appendChild(table); root.appendChild(foot);

		function render(moveFocus) {
			var was = today;
			now = new Date(); today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
			if (!picked && (was.y !== today.y || was.m !== today.m || was.d !== today.d)) {      // a new day has started
				if (view.y === was.y && view.m === was.m) { view = { y: today.y, m: today.m }; }
				sel = { y: today.y, m: today.m, d: today.d }; focus = { y: today.y, m: today.m, d: today.d };
			}
			selM.value = view.m; selY.value = view.y;
			table.setAttribute('aria-label', MONTHS[view.m] + ' ' + view.y);
			while (tbody.firstChild) { tbody.removeChild(tbody.firstChild); }
			var offset = (new Date(view.y, view.m, 1).getDay() - first + 7) % 7;
			var focusKey = (focus.y === view.y && focus.m === view.m) ? key(focus.y, focus.m, focus.d) : key(view.y, view.m, 1);
			var focusCell = null;
			for (var r = 0; r < 6; r++) {
				var tr = el('tr'), rowDates = [];
				for (var c = 0; c < 7; c++) { rowDates.push(new Date(view.y, view.m, 1 - offset + r * 7 + c)); }
				var thu = rowDates.filter(function (x) { return x.getDay() === 4; })[0];
				var wn = el('th', 'wn', isoWeek(thu.getFullYear(), thu.getMonth(), thu.getDate())); wn.scope = 'row'; tr.appendChild(wn);
				rowDates.forEach(function (dt) {
					var y2 = dt.getFullYear(), m2 = dt.getMonth(), d2 = dt.getDate(), dow = dt.getDay();
					var td = el('td'); td.setAttribute('role', 'gridcell');
					var cls = [];
					if (dow === 0 || dow === 6) { cls.push('we'); }
					if (m2 !== view.m || y2 !== view.y) { td.className = 'out ' + cls.join(' '); td.appendChild(el('span', '', d2)); tr.appendChild(td); return; }
					var k = key(y2, m2, d2), b = el('button', '', d2); b.type = 'button'; b.setAttribute('data-date', k);
					b.setAttribute('aria-label', DAYS_LONG[dow] + ', ' + d2 + ' ' + MONTHS[m2] + ' ' + y2);
					if (y2 === today.y && m2 === today.m && d2 === today.d) { cls.push('today'); b.setAttribute('aria-current', 'date'); }
					var isSel = (y2 === sel.y && m2 === sel.m && d2 === sel.d);
					if (isSel) { cls.push('sel'); }
					td.setAttribute('aria-selected', isSel ? 'true' : 'false');
					td.className = cls.join(' ');
					b.tabIndex = (k === focusKey) ? 0 : -1; if (k === focusKey) { focusCell = b; }
					td.appendChild(b); tr.appendChild(td);
				});
				tbody.appendChild(tr);
			}
			if (moveFocus && focusCell) { focusCell.focus(); }
		}

		function show(y, m, d, moveFocus) {                       // go to a date (any month), keep it focused
			var dt = new Date(y, m, d);
			if (dt.getFullYear() < YEAR_MIN || dt.getFullYear() > YEAR_MAX) { return; }
			focus = { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() };
			view = { y: focus.y, m: focus.m };
			render(moveFocus);
		}
		function shiftMonth(delta, moveFocus) {
			var dt = new Date(view.y, view.m + delta, 1);
			if (dt.getFullYear() < YEAR_MIN || dt.getFullYear() > YEAR_MAX) { return; }
			var last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
			show(dt.getFullYear(), dt.getMonth(), Math.min(focus.d, last), moveFocus);
		}

		prev.addEventListener('click', function () { shiftMonth(-1, false); });
		next.addEventListener('click', function () { shiftMonth(1, false); });
		selM.addEventListener('change', function () { view.m = +selM.value; show(view.y, view.m, Math.min(focus.d, new Date(view.y, view.m + 1, 0).getDate()), false); });
		selY.addEventListener('change', function () { view.y = +selY.value; show(view.y, view.m, Math.min(focus.d, new Date(view.y, view.m + 1, 0).getDate()), false); });
		todayBtn.addEventListener('click', function () { picked = false; sel = { y: today.y, m: today.m, d: today.d }; show(today.y, today.m, today.d, false); });
		tbody.addEventListener('click', function (e) {
			var b = e.target.closest ? e.target.closest('button') : null; if (!b) { return; }
			var p = b.getAttribute('data-date').split('-'); picked = true; sel = { y: +p[0], m: +p[1] - 1, d: +p[2] }; focus = { y: sel.y, m: sel.m, d: sel.d }; render(true);
		});
		tbody.addEventListener('keydown', function (e) {
			var b = e.target.closest ? e.target.closest('button') : null; if (!b) { return; }
			var p = b.getAttribute('data-date').split('-'), y = +p[0], m = +p[1] - 1, d = +p[2], dow = new Date(y, m, d).getDay(), k = e.key, handled = true;
			if (k === 'ArrowLeft') { show(y, m, d - 1, true); }
			else if (k === 'ArrowRight') { show(y, m, d + 1, true); }
			else if (k === 'ArrowUp') { show(y, m, d - 7, true); }
			else if (k === 'ArrowDown') { show(y, m, d + 7, true); }
			else if (k === 'Home') { show(y, m, d - ((dow - first + 7) % 7), true); }
			else if (k === 'End') { show(y, m, d + 6 - ((dow - first + 7) % 7), true); }
			else if (k === 'PageUp') { focus = { y: y, m: m, d: d }; shiftMonth(e.shiftKey ? -12 : -1, true); }
			else if (k === 'PageDown') { focus = { y: y, m: m, d: d }; shiftMonth(e.shiftKey ? 12 : 1, true); }
			else { handled = false; }
			if (handled) { e.preventDefault(); }
		});

		/* keep "today" right after midnight and after sleep / hidden tab */
		function scheduleMidnight() {
			clearTimeout(midnight);
			var n = new Date(), ms = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1).getTime() - n.getTime();
			midnight = setTimeout(function () { render(false); scheduleMidnight(); }, ms);
		}
		document.addEventListener('visibilitychange', function () { if (!document.hidden) { render(false); scheduleMidnight(); } });
		render(false); scheduleMidnight();
	}
	global.MiniCalendar = MiniCalendar;
})(window);
