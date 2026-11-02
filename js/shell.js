/* shell.js - behaviour of the site shell (index.html).
 *  1. syncShell(): menu highlight / breadcrumb / (hidden) <h1> / frame title follow the page really shown in the frame
 *  2. rail: toggle (remembered), hover/focus "peek" while collapsed, phone drawer
 *  3. contact: non-blocking dialog (falls back to alert())
 *  4. clock: 24-hour hh:mm:ss, local time, no library
 *  5. version label: reads version.txt (build date + commit, filled in by the GitHub Pages build)
 * Plain ES5, no dependencies. Without JavaScript the nav links still work (target = frame).
 */
(function () {
	'use strict';

	var html = document.documentElement;
	var frame = document.getElementById('iframe_area');
	var titleEl = document.getElementById('title');
	var crumbEl = document.getElementById('sitemap');
	var links = [].slice.call(document.querySelectorAll('.nav3 a[target="page_iframe"]'));
	var byKey = {};
	var userNavigated = false;
	var deepLink = html.getAttribute('data-deeplink');

	function keyOf(url) {
		var u = String(url).split('#')[0].split('?')[0];
		try { u = decodeURIComponent(u); } catch (e) {}
		return u.substring(u.lastIndexOf('/') + 1);
	}
	function hashOf(url) { var i = String(url).indexOf('#'); return i < 0 ? '' : String(url).substring(i); }
	links.forEach(function (a) {                              // plain file name = the page; 'file#fragment' = a section of a page that has its own menu entry
		var href = a.getAttribute('href'), k = keyOf(href), h = hashOf(href);
		if (h) { byKey[k + h] = a; if (!byKey[k]) { byKey[k] = a; } } else { byKey[k] = a; }
	});

	function label(a) { return a.querySelector('.lbl').textContent.replace(/\s+/g, ' ').trim(); }

	/* ---------------------------------------------------------------- menu sync */
	function setOpen(li, open) {
		li.classList.toggle('open', open);
		var tg = li.querySelector('.tg');
		if (tg) { tg.setAttribute('aria-expanded', open ? 'true' : 'false'); }
	}

	function sync(a, keepHeading) {
		links.forEach(function (l) { l.removeAttribute('aria-current'); });
		a.setAttribute('aria-current', 'page');

		var section = a.closest('li.has-sub');             // the section this page belongs to (if any)
		[].forEach.call(document.querySelectorAll('.nav3 li.has-sub'), function (li) { setOpen(li, li === section); });

		var parent = null;
		if (section && section.querySelector('.sub').contains(a)) {
			parent = section.querySelector('.row a');       // child page: its parent comes first in the breadcrumb
		}
		var name = label(a);
		var trail = parent ? label(parent) + ' / ' + name : name;

		// breadcrumb = the one visible location; the parent is a link (it behaves like the menu link)
		while (crumbEl.firstChild) { crumbEl.removeChild(crumbEl.firstChild); }
		if (parent) {
			var li0 = document.createElement('li');
			var link = document.createElement('a');
			link.href = parent.getAttribute('href').split('?')[0];
			link.target = 'page_iframe';
			link.title = parent.getAttribute('title') || '';
			link.textContent = label(parent);
			link.addEventListener('click', function (e) { e.preventDefault(); parent.click(); });
			li0.appendChild(link);
			crumbEl.appendChild(li0);
		}
		var li1 = document.createElement('li');
		li1.setAttribute('aria-current', 'page');
		li1.textContent = name;
		crumbEl.appendChild(li1);

		// the heading is visually hidden (accessibility, search engines): the selected item's own name
		if (!keepHeading) { titleEl.textContent = name; }
		frame.setAttribute('title', trail);                  // screen readers announce the frame properly
	}

	function syncShell() {
		var key;
		try { key = keyOf(frame.contentWindow.location.pathname); }
		catch (e) { return; }                                // cross-origin or not readable: keep what the click set
		var a = byKey[key + frame.contentWindow.location.hash] || byKey[key];
		if (!a) { return; }                                  // a page that is not in the menu: leave the menu alone
		// first load of the default page keeps the welcome heading (as before)
		var keep = !userNavigated && !deepLink && key === 'main_page.html';
		sync(a, keep);
	}

	links.forEach(function (a) {
		a.addEventListener('click', function () {
			// cache-busting seed, as before: every menu click fetches a fresh copy of the page
			var parts = a.getAttribute('href').split('#'); a.href = parts[0].split('?')[0] + '?seed=' + new Date().getTime() + (parts.length > 1 ? '#' + parts[1] : '');
			userNavigated = true;
			sync(a, false);                                  // immediate feedback; corrected by the frame's load event
			closeDrawer();
		});
	});
	frame.addEventListener('load', syncShell);

	/* nothing is open until the first sync; show the section of the default/deep-linked page right away */
	if (deepLink && byKey[deepLink]) { sync(byKey[deepLink], false); }

	/* ---------------------------------------------------------------- section chevrons */
	[].forEach.call(document.querySelectorAll('.nav3 .tg'), function (tg) {
		tg.addEventListener('click', function () {
			var li = tg.closest('li');
			setOpen(li, !li.classList.contains('open'));
		});
	});

	/* ---------------------------------------------------------------- rail: toggle / peek / drawer */
	var rail = document.getElementById('rail');
	var wrap = document.getElementById('railwrap');
	var toggle = document.getElementById('rail-toggle');
	var menuBtn = document.getElementById('menu-btn');
	var scrim = document.getElementById('scrim');
	var phone = window.matchMedia('(max-width: 820px)');
	var canHover = window.matchMedia('(hover: hover) and (min-width: 821px)');
	var peekTimer = null;
	var userChose = false;

	function isCollapsed() { return html.classList.contains('rail-collapsed'); }

	function paintToggle() {
		var drawer = html.classList.contains('drawer-open');
		var collapsed = isCollapsed() && !drawer;
		var text = drawer ? 'Close menu' : (collapsed ? 'Expand sidebar' : 'Collapse sidebar');
		toggle.setAttribute('aria-label', text);
		toggle.setAttribute('title', text);
		toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
	}

	function setCollapsed(collapsed, remember) {
		html.classList.toggle('rail-collapsed', collapsed);
		html.classList.remove('rail-peek');
		if (remember) { try { localStorage.setItem('rail', collapsed ? 'collapsed' : 'expanded'); } catch (e) {} }
		paintToggle();
	}

	function openDrawer() {
		html.classList.add('drawer-open');
		menuBtn.setAttribute('aria-expanded', 'true');
		paintToggle();
		toggle.focus();
	}
	function closeDrawer() {
		if (!html.classList.contains('drawer-open')) { return; }
		html.classList.remove('drawer-open');
		menuBtn.setAttribute('aria-expanded', 'false');
		paintToggle();
		menuBtn.focus();
	}

	toggle.addEventListener('click', function () {
		if (html.classList.contains('drawer-open')) { closeDrawer(); return; }
		userChose = true;
		setCollapsed(!isCollapsed(), true);                  // also turns a peek into the permanent choice
	});
	menuBtn.addEventListener('click', openDrawer);
	scrim.addEventListener('click', closeDrawer);

	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Escape' && e.key !== 'Esc') { return; }
		if (html.classList.contains('drawer-open')) { closeDrawer(); }
		else if (html.classList.contains('rail-peek')) { html.classList.remove('rail-peek'); }
		else { return; }
	});

	/* keep keyboard focus inside the drawer while it is open */
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Tab' || !html.classList.contains('drawer-open')) { return; }
		var f = [].filter.call(rail.querySelectorAll('a[href], button'), function (el) { return el.offsetParent !== null; });
		if (!f.length) { return; }
		var first = f[0], last = f[f.length - 1];
		if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
		else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
	});

	/* peek: while collapsed, hovering (after a short delay) or focusing the rail floats the full rail over the page */
	function peekOn() { if (isCollapsed() && canHover.matches) { html.classList.add('rail-peek'); } }
	wrap.addEventListener('mouseenter', function () {
		if (!isCollapsed() || !canHover.matches) { return; }
		clearTimeout(peekTimer);
		peekTimer = setTimeout(peekOn, 150);
	});
	wrap.addEventListener('mouseleave', function () {
		clearTimeout(peekTimer);
		if (!rail.contains(document.activeElement)) { html.classList.remove('rail-peek'); }
	});
	rail.addEventListener('focusin', function () { if (isCollapsed() && !phone.matches) { html.classList.add('rail-peek'); } });
	rail.addEventListener('focusout', function (e) {
		if (!e.relatedTarget || !rail.contains(e.relatedTarget)) { html.classList.remove('rail-peek'); }
	});

	/* defaults follow the window width until the visitor chooses */
	function onResize() {
		if (!phone.matches) { closeDrawerSilently(); }
		if (!userChose) {
			var saved = null;
			try { saved = localStorage.getItem('rail'); } catch (e) {}
			if (!saved) { setCollapsed(window.innerWidth < 1100, false); }
		}
	}
	function closeDrawerSilently() {
		if (!html.classList.contains('drawer-open')) { return; }
		html.classList.remove('drawer-open');
		menuBtn.setAttribute('aria-expanded', 'false');
		paintToggle();
	}
	window.addEventListener('resize', onResize);
	paintToggle();

	/* ---------------------------------------------------------------- contact dialog */
	var contact = document.getElementById('contact-link');
	var dialog = document.getElementById('contact-dialog');
	if (contact && dialog) {
		contact.addEventListener('click', function (e) {
			e.preventDefault();                               // without JavaScript the mailto: link still works
			closeDrawerSilently();
			if (typeof dialog.showModal === 'function') {
				dialog.showModal();
			} else {
				alert('Feel free to contact me at the following email address :\n\naristotelis.metsinis@gmail.com');
			}
		});
		dialog.addEventListener('close', function () { contact.focus(); });
		dialog.addEventListener('click', function (e) { if (e.target === dialog) { dialog.close(); } });   // click on the backdrop
	}

	/* ---------------------------------------------------------------- clock (24 h, hh:mm:ss, local time) */
	var clockEl = document.getElementById('clock');
	if (clockEl) {
		var cell = [clockEl.querySelector('.h'), clockEl.querySelector('.m'), clockEl.querySelector('.s')];
		var shown = ['', '', ''];
		var clockTimer = null;
		var pad = function (n) { return (n < 10 ? '0' : '') + n; };
		var tick = function () {
			var d = new Date();
			var now = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())];
			for (var i = 0; i < 3; i++) {
				if (now[i] !== shown[i]) { shown[i] = now[i]; cell[i].textContent = now[i]; }   // write only what changed
			}
			clockTimer = setTimeout(tick, 1000 - d.getMilliseconds() + 20);                     // just after the next real second
		};
		var clockStart = function () { clearTimeout(clockTimer); tick(); };
		document.addEventListener('visibilitychange', function () {
			if (document.hidden) { clearTimeout(clockTimer); } else { clockStart(); }          // no timer while hidden; resync on return
		});
		if (cell[0] && cell[1] && cell[2]) { clockStart(); }
	}

	/* ---------------------------------------------------------------- version label */
	var verBox = document.getElementById('version');
	var verLink = document.getElementById('version-link');
	if (verBox && verLink && window.fetch) {
		var isLocal = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname);
		fetch('version.txt', { cache: 'no-cache' })
			.then(function (r) { return r.ok ? r.text() : ''; })
			.then(function (txt) {
				// expected: "2026.10.31 <40-hex commit> 2026-10-31 00:41 +0000"; anything else (raw template, error page) is ignored
				var m = /^(\d{4}\.\d{2}\.\d{2}) ([0-9a-f]{40}) (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) ([+-]\d{4})$/.exec(String(txt).trim());
				if (m) {
					verLink.textContent = m[1] + '.' + m[2].substring(0, 7);
					verLink.href = 'https://github.com/aristotelis-metsinis/aristotelis-metsinis.github.io/commit/' + m[2];
					verLink.title = 'Built ' + m[3] + ' (' + m[4] + ') from commit ' + m[2] + ' - open on GitHub';
				} else if (isLocal) {
					verLink.textContent = 'dev (local copy)';                          // the template is only filled in by GitHub Pages
					verLink.removeAttribute('href');
					verLink.title = 'version.txt is filled in by the GitHub Pages build';
				} else {
					return;                                                           // not available: show nothing
				}
				verBox.hidden = false;
			})
			.catch(function () {});
	}
})();
