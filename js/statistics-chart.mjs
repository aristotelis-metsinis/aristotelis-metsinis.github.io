import { evaluatePolynomial } from "./statistics-regression.mjs";

export function renderChart(container, points, regression, xLabel = "X", yLabel = "Y") {
  const width = Math.max(container.clientWidth || 800, 420);
  const height = Math.max(500, Math.min(680, width * 0.58));
  const pad = { left: 78, right: 28, top: 32, bottom: 68 };
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xPad = (xmax - xmin || Math.max(Math.abs(xmin), 1)) * 0.08;
  const yPad = (ymax - ymin || Math.max(Math.abs(ymin), 1)) * 0.08;
  const x0 = xmin - xPad, x1 = xmax + xPad, y0 = ymin - yPad, y1 = ymax + yPad;
  const sx = x => pad.left + (x - x0) / (x1 - x0) * (width - pad.left - pad.right);
  const sy = y => height - pad.bottom - (y - y0) / (y1 - y0) * (height - pad.top - pad.bottom);
  const xTicks = niceTicks(x0, x1, 6), yTicks = niceTicks(y0, y1, 6);
  const grid = [
    ...xTicks.map(v => `<line x1="${sx(v)}" y1="${pad.top}" x2="${sx(v)}" y2="${height-pad.bottom}" class="grid"/>`),
    ...yTicks.map(v => `<line x1="${pad.left}" y1="${sy(v)}" x2="${width-pad.right}" y2="${sy(v)}" class="grid"/>`)
  ].join("");
  const tickLabels = [
    ...xTicks.map(v => `<text x="${sx(v)}" y="${height-pad.bottom+22}" text-anchor="middle" class="tick-label">${fmt(v)}</text>`),
    ...yTicks.map(v => `<text x="${pad.left-10}" y="${sy(v)+4}" text-anchor="end" class="tick-label">${fmt(v)}</text>`)
  ].join("");
  const circles = points.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="4" class="point"><title>x=${fmt(p.x)}, y=${fmt(p.y)}</title></circle>`).join("");
  const curvePoints = Array.from({ length: 220 }, (_, i) => {
    const x = x0 + i / 219 * (x1 - x0);
    return `${sx(x)},${sy(evaluatePolynomial(regression.coefficients, x))}`;
  }).join(" ");

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Scatter plot of observations with degree ${regression.degree} least-squares regression">
    ${grid}
    <line x1="${pad.left}" y1="${height-pad.bottom}" x2="${width-pad.right}" y2="${height-pad.bottom}" class="axis"/>
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height-pad.bottom}" class="axis"/>
    ${tickLabels}
    <polyline points="${curvePoints}" class="regression"/>
    ${circles}
    <g class="legend" transform="translate(${pad.left + 12}, ${pad.top + 10})">
      <circle cx="5" cy="5" r="4" class="point"/><text x="15" y="9" class="legend-label">Observations</text>
      <line x1="110" y1="5" x2="130" y2="5" class="regression"/><text x="140" y="9" class="legend-label">Regression</text>
    </g>
    <text x="${width/2}" y="${height-16}" text-anchor="middle" class="axis-label">${escapeHtml(xLabel)}</text>
    <text x="18" y="${height/2}" transform="rotate(-90 18 ${height/2})" text-anchor="middle" class="axis-label">${escapeHtml(yLabel)}</text>
  </svg>`;
}

function niceTicks(min, max, count) {
  const span = max - min || 1;
  const raw = span / Math.max(count - 1, 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let value = start; value <= max + step * 1e-9; value += step) ticks.push(Number(value.toPrecision(12)));
  return ticks.length >= 2 ? ticks : [min, max];
}

function fmt(value) { return Number.isFinite(value) ? Number(value.toPrecision(6)).toString() : "—"; }
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c])); }
