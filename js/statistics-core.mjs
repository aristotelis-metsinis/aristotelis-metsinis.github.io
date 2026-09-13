export function descriptive(values) {
  const n = values.length;
  if (!n) return emptyStats();

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const deviations = values.map((value) => value - mean);
  const sumSquares = deviations.reduce((sum, d) => sum + d * d, 0);
  const variance = n > 1 ? sumSquares / (n - 1) : NaN;
  const stdDev = Number.isFinite(variance) ? Math.sqrt(variance) : NaN;
  const sumCubes = deviations.reduce((sum, d) => sum + d ** 3, 0);
  const sumFourth = deviations.reduce((sum, d) => sum + d ** 4, 0);
  // Exact legacy convention: standardized central moments use the sample SD.
  const rawSkewness = stdDev > 0 ? sumCubes / (n * stdDev ** 3) : NaN;
  const rawExcessKurtosis = stdDev > 0 ? sumFourth / (n * stdDev ** 4) - 3 : NaN;
  const skewness = n > 2 && stdDev > 0
    ? (n / ((n - 1) * (n - 2))) * deviations.reduce((sum, d) => sum + (d / stdDev) ** 3, 0)
    : NaN;
  const excessKurtosis = n > 3 && stdDev > 0
    ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) *
        deviations.reduce((sum, d) => sum + (d / stdDev) ** 4, 0) -
      (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
    : NaN;

  return {
    n, mean, median: percentile(sorted, 50), min: sorted[0], max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    q1: percentile(sorted, 25), q3: percentile(sorted, 75),
    iqr: percentile(sorted, 75) - percentile(sorted, 25),
    variance, stdDev, skewness, excessKurtosis, rawSkewness, rawExcessKurtosis,
    within1StdPercent: percentage(values, (v) => Math.abs(v - mean) <= stdDev),
    within2StdPercent: percentage(values, (v) => Math.abs(v - mean) <= 2 * stdDev),
    within3StdPercent: percentage(values, (v) => Math.abs(v - mean) <= 3 * stdDev)
  };
}

export function covariance(x, y) {
  if (x.length !== y.length || x.length < 2) return NaN;
  const mx = average(x), my = average(y);
  return x.reduce((sum, value, i) => sum + (value - mx) * (y[i] - my), 0) / (x.length - 1);
}

export function correlation(x, y) {
  if (x.length !== y.length || x.length < 2) return NaN;
  const mx = average(x), my = average(y);
  const sx = Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0));
  const sy = Math.sqrt(y.reduce((s, v) => s + (v - my) ** 2, 0));
  return sx && sy ? x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / (sx * sy) : NaN;
}

export function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percentage(values, predicate) {
  return values.length ? 100 * values.filter(predicate).length / values.length : NaN;
}

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function emptyStats() {
  return Object.fromEntries(["n","mean","median","min","max","range","q1","q3","iqr","variance","stdDev","skewness","excessKurtosis","rawSkewness","rawExcessKurtosis","within1StdPercent","within2StdPercent","within3StdPercent"].map(k => [k, NaN]));
}
