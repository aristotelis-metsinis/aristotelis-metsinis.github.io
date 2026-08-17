import { createChartModel } from './erlang-chart.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function pathForCurve(points, plot) {
  const commands = [];
  let hasPoint = false;

  for (const point of points) {
    if (point.normalizedY === null) {
      hasPoint = false;
      continue;
    }

    const x = plot.left + point.normalizedX * plot.width;
    const y = plot.top + point.normalizedY * plot.height;
    commands.push(hasPoint ? `L ${x.toFixed(2)} ${y.toFixed(2)}` : `M ${x.toFixed(2)} ${y.toFixed(2)}`);
    hasPoint = true;
  }

  return commands.join(' ');
}

function pointHitAreasForCurve(curve, plot) {
  const parts = [];

  for (const point of curve.points) {
    if (!point.visible || point.normalizedY === null) {
      continue;
    }

    const x = plot.left + point.normalizedX * plot.width;
    const y = plot.top + point.normalizedY * plot.height;

    parts.push(
      `<circle class="chart-point-hit-area" ` +
      `cx="${x.toFixed(2)}" ` +
      `cy="${y.toFixed(2)}" ` +
      `r="7" ` +
      `data-circuits="${escapeXml(curve.circuits)}" ` +
      `data-traffic="${escapeXml(point.traffic)}" ` +
      `data-probability="${escapeXml(point.probability)}" ` +
      `aria-hidden="true" />`
    );
  }

  return parts.join('');
}

function createXTickValues(maxTraffic) {
  const count = 5;
  return Array.from({ length: count + 1 }, (_, index) => {
    const ratio = index / count;
    return { ratio, value: maxTraffic * ratio };
  });
}

export function renderChartSvg(result, options = {}) {
  const width = Math.max(640, Number(options.width) || 960);
  const height = Math.max(420, Number(options.height) || 560);
  const model = createChartModel(result);

  const plot = {
    left: 76,
    right: 28,
    top: 28,
    bottom: 62
  };
  plot.width = width - plot.left - plot.right;
  plot.height = height - plot.top - plot.bottom;

  const parts = [];
  parts.push(`<svg xmlns="${SVG_NS}" class="erlang-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description">`);
  parts.push('<title id="chart-title">Traffic Load vs Erlang Loss Probability</title>');
  parts.push(`<desc id="chart-description">Erlang B loss probability curves for 1 through ${model.curves.length} circuits, plotted against offered traffic on a base-10 logarithmic probability axis.</desc>`);
  parts.push(`<rect class="chart-background" x="0" y="0" width="${width}" height="${height}" rx="12" />`);

  for (const tick of model.ticks) {
    const y = plot.top + tick.normalizedY * plot.height;
    parts.push(`<line class="chart-grid-line" x1="${plot.left}" y1="${y.toFixed(2)}" x2="${(plot.left + plot.width).toFixed(2)}" y2="${y.toFixed(2)}" />`);
    parts.push(`<text class="chart-y-label" x="${plot.left - 12}" y="${(y + 4).toFixed(2)}" text-anchor="end">${escapeXml(tick.label)}</text>`);
  }

  parts.push(`<line class="chart-axis" x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.top + plot.height}" />`);
  parts.push(`<line class="chart-axis" x1="${plot.left}" y1="${plot.top + plot.height}" x2="${plot.left + plot.width}" y2="${plot.top + plot.height}" />`);

  for (const tick of createXTickValues(model.maximumTraffic)) {
    const x = plot.left + tick.ratio * plot.width;
    parts.push(`<line class="chart-x-tick" x1="${x.toFixed(2)}" y1="${plot.top + plot.height}" x2="${x.toFixed(2)}" y2="${plot.top + plot.height + 6}" />`);
    parts.push(`<text class="chart-x-label" x="${x.toFixed(2)}" y="${plot.top + plot.height + 24}" text-anchor="middle">${escapeXml(formatNumber(tick.value))}</text>`);
  }

  for (const curve of model.curves) {
    const path = pathForCurve(curve.points, plot);

    if (path) {
      parts.push(`<path class="chart-curve" data-circuits="${curve.circuits}" d="${path}" />`);
      parts.push(pointHitAreasForCurve(curve, plot));
    }
  }

  parts.push(`<text class="chart-axis-title" x="${plot.left + plot.width / 2}" y="${height - 14}" text-anchor="middle">Offered Traffic (Erlangs)</text>`);
  parts.push(`<text class="chart-axis-title" transform="translate(18 ${plot.top + plot.height / 2}) rotate(-90)" text-anchor="middle">Erlang Loss Probability</text>`);
  parts.push('</svg>');
  return parts.join('');
}

function formatNumber(value) {
  if (value === 0) return '0';
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return value.toString();
  return Number(value.toPrecision(4)).toString();
}
