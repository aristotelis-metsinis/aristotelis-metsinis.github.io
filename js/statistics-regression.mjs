import { average } from "./statistics-core.mjs";

export function linearRegression(points) {
  if (points.length < 2) throw new Error("At least 2 observations are required for linear regression.");
  const x = points.map(p => p.x), y = points.map(p => p.y);
  const mx = average(x), my = average(y);
  const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  const syy = y.reduce((s, v) => s + (v - my) ** 2, 0);
  if (sxx === 0 || syy === 0) throw new Error("Linear regression is undefined because X or Y has zero variance.");
  const sxy = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  return buildModel(points, [intercept, slope], 1, syy);
}

export function polynomialRegression(points, degree) {
  if (!Number.isInteger(degree) || degree < 1 || degree > 5) throw new Error("Polynomial degree must be between 1 and 5.");
  if (degree === 1) return linearRegression(points);
  if (points.length <= degree) throw new Error(`At least ${degree + 1} observations are required.`);

  // Center/scale X before solving to substantially reduce conditioning problems.
  const xs = points.map(p => p.x);
  const center = average(xs);
  const scale = Math.sqrt(xs.reduce((s, x) => s + (x - center) ** 2, 0) / xs.length);
  if (!Number.isFinite(scale) || scale === 0) throw new Error("Polynomial regression is undefined because all X values are identical.");
  const z = xs.map(x => (x - center) / scale);
  const design = z.map(v => Array.from({ length: degree + 1 }, (_, j) => v ** j));
  const y = points.map(p => p.y);
  const coefficientsZ = solveLeastSquaresQR(design, y);
  const coefficientsX = transformCoefficients(coefficientsZ, center, scale);
  const model = buildModel(points, coefficientsX, degree, y.reduce((s, v) => s + (v - average(y)) ** 2, 0));
  return { ...model, scaledCoefficients: coefficientsZ, xCenter: center, xScale: scale };
}

export function evaluatePolynomial(coefficients, x) {
  return coefficients.reduceRight((value, coefficient) => coefficient + x * value, 0);
}

function buildModel(points, coefficients, degree, sst) {
  const predictions = points.map(p => evaluatePolynomial(coefficients, p.x));
  const residuals = points.map((p, i) => p.y - predictions[i]);
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const rSquared = sst === 0 ? (sse === 0 ? 1 : NaN) : 1 - sse / sst;
  const dof = points.length - (degree + 1);
  return { degree, coefficients, predictions, residuals, sse, mse: dof > 0 ? sse / dof : NaN,
    rmse: Math.sqrt(sse / points.length), mae: residuals.reduce((s, r) => s + Math.abs(r), 0) / points.length,
    rSquared, dof };
}

function solveLeastSquaresQR(A, b) {
  const m = A.length, n = A[0].length;
  const Q = Array.from({ length: n }, () => Array(m).fill(0));
  const R = Array.from({ length: n }, () => Array(n).fill(0));
  const columns = Array.from({ length: n }, (_, j) => A.map(row => row[j]));
  for (let j = 0; j < n; j++) {
    const v = columns[j].slice();
    for (let i = 0; i < j; i++) {
      R[i][j] = dot(Q[i], columns[j]);
      for (let k = 0; k < m; k++) v[k] -= R[i][j] * Q[i][k];
    }
    const norm = Math.hypot(...v);
    if (norm < 1e-12) throw new Error("Polynomial regression is numerically singular for this dataset.");
    R[j][j] = norm;
    for (let k = 0; k < m; k++) Q[j][k] = v[k] / norm;
  }
  const qtB = Q.map(q => dot(q, b));
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let value = qtB[i];
    for (let j = i + 1; j < n; j++) value -= R[i][j] * x[j];
    x[i] = value / R[i][i];
  }
  return x;
}

function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }

function transformCoefficients(c, center, scale) {
  // Convert polynomial in z=(x-center)/scale to polynomial in x.
  const a = -center / scale;
  const b = 1 / scale;
  let result = [c[c.length - 1]];
  for (let j = c.length - 2; j >= 0; j--) {
    const next = Array(result.length + 1).fill(0);
    for (let k = 0; k < result.length; k++) {
      next[k] += result[k] * a;
      next[k + 1] += result[k] * b;
    }
    next[0] += c[j];
    result = next;
  }
  return result;
}
