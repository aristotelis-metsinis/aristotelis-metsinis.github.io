import { parseText } from "./statistics-parser.mjs";
import { descriptive, covariance, correlation } from "./statistics-core.mjs";
import { linearRegression, polynomialRegression } from "./statistics-regression.mjs";
import { renderChart } from "./statistics-chart.mjs";

const $ = (id) => document.getElementById(id);
const fileInput = $("fileInput");
const analyzeButton = $("analyzeButton");
const resetButton = $("resetButton");
const delimiter = $("delimiter");
const degree = $("regressionDegree");
let selectedFile = null;

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files?.[0] ?? null;
  analyzeButton.disabled = !selectedFile;
  $("status").textContent = selectedFile ? `${selectedFile.name} selected.` : "Select a text file.";
});

analyzeButton.addEventListener("click", async () => {
  clearResults();
  try {
    const text = await selectedFile.text();
    const parsed = parseText(text, delimiter.value);
    if (!parsed.rows.length) throw new Error("No valid X,Y observations were found.");
    const points = parsed.rows;
    const xStats = descriptive(points.map(p => p.x));
    const yStats = descriptive(points.map(p => p.y));
    const r = correlation(points.map(p => p.x), points.map(p => p.y));
    const cov = covariance(points.map(p => p.x), points.map(p => p.y));

    renderSummary(points, xStats, yStats, r);
    renderDescriptive(xStats, yStats);
    renderValidation(parsed);
    $("status").textContent = `Analyzed ${points.length} valid observations from ${selectedFile.name}.`;

    try {
      const selectedDegree = Number(degree.value);
      const regression = selectedDegree === 1
        ? linearRegression(points)
        : polynomialRegression(points, selectedDegree);
      renderRegression(regression, r, cov);
      $("equation").textContent = `y = ${equation(regression.coefficients, points)}`;
      renderChart($("chart"), points, regression);
    } catch (regressionError) {
      $("regressionStats").innerHTML = `<p class="validation-error"><strong>Regression unavailable:</strong> ${escapeHtml(regressionError.message)}</p>`;
      $("equation").textContent = "Regression curve unavailable.";
      $("chart").textContent = `Regression curve unavailable. ${regressionError.message}`;
    }
  } catch (error) {
    $("status").textContent = error.message;
    $("status").classList.add("validation-error");
  }
});

resetButton.addEventListener("click", () => {
  fileInput.value = "";
  selectedFile = null;
  analyzeButton.disabled = true;
  clearResults();
  $("status").textContent = "Select a text file containing one X Y pair per row.";
  $("status").classList.remove("validation-error");
});

function clearResults() {
  ["summary", "descriptiveStats", "regressionStats", "validation", "chart", "equation"].forEach(id => $(id).replaceChildren());
  $("status").classList.remove("validation-error");
}

function renderSummary(points, x, y, r) {
  $("summary").innerHTML = [
    ["Observations", points.length],
    ["X mean", format(x.mean)],
    ["Y mean", format(y.mean)],
    ["Pearson r", format(r)]
  ].map(([label,value]) => `<div class="metric"><span class="label">${label}</span><span class="value">${value}</span></div>`).join("");
}

function renderDescriptive(x, y) {
  const rows = [
    ["Count", x.n, y.n], ["Mean", x.mean, y.mean], ["Median", x.median, y.median],
    ["Sample standard deviation", x.stdDev, y.stdDev], ["Sample variance", x.variance, y.variance],
    ["Minimum", x.min, y.min], ["Maximum", x.max, y.max], ["Range", x.range, y.range],
    ["First quartile (Q1)", x.q1, y.q1], ["Third quartile (Q3)", x.q3, y.q3], ["Interquartile range (IQR)", x.iqr, y.iqr],
    ["Skewness (legacy/raw moment)", x.rawSkewness, y.rawSkewness],
    ["Skewness (bias-corrected sample)", x.skewness, y.skewness],
    ["Excess kurtosis (legacy/raw moment)", x.rawExcessKurtosis, y.rawExcessKurtosis],
    ["Excess kurtosis (bias-corrected sample)", x.excessKurtosis, y.excessKurtosis],
    ["Percentage within ±1 sample standard deviation", x.within1StdPercent, y.within1StdPercent],
    ["Percentage within ±2 sample standard deviations", x.within2StdPercent, y.within2StdPercent],
    ["Percentage within ±3 sample standard deviations", x.within3StdPercent, y.within3StdPercent]
  ];
  $("descriptiveStats").innerHTML = table(["Measure","X","Y"], rows, (v, rowIndex, cellIndex) => rowIndex >= 15 && cellIndex > 0 ? `${format(v)}%` : format(v));
}

function renderRegression(model, r, cov) {
  const rows = [
    ["Model degree", model.degree], ["Pearson correlation coefficient (r)", r],
    ["Coefficient of determination (R²)", model.rSquared], ["Sample covariance", cov],
    ["Sum of squared errors (SSE)", model.sse], ["Mean squared error (MSE)", model.mse],
    ["Root mean squared error (RMSE)", model.rmse], ["Mean absolute error (MAE)", model.mae],
    ["Residual degrees of freedom", model.dof]
  ];
  $("regressionStats").innerHTML = table(["Diagnostic","Value"], rows);
}

function renderValidation(parsed) {
  const errors = parsed.errors.length
    ? `<p class="validation-error">${parsed.errors.length} row(s) rejected.</p><ul>${parsed.errors.slice(0, 20).map(e => `<li>Line ${e.line}: ${e.reason}</li>`).join("")}</ul>`
    : `<p class="validation-ok">All data rows were valid.</p>`;
  $("validation").innerHTML = `<p>Total lines: ${parsed.totalLines}; valid observations: ${parsed.rows.length}; rejected rows: ${parsed.errors.length}</p>${errors}`;
}

function table(headers, rows, formatter = format) {
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row,rowIndex) => `<tr>${row.map((v,i) => `<td>${i === 0 ? v : formatter(v,rowIndex,i)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function equation(coefficients, points) {
  const coefficientTolerance = 1e-12;
  const terms = [];

  const xs = points.map(p => p.x);
  const xScale = Math.max(
    1,
    ...xs.map(x => Math.abs(x))
  );

  coefficients.forEach((c, i) => {
    if (!Number.isFinite(c)) return;

    // Keep the intercept if it is numerically meaningful.
    // For higher-order terms, judge significance by the
    // contribution of the term over the observed X scale.
    const contribution = Math.abs(c) * (i === 0 ? 1 : xScale ** i);

    if (
      Math.abs(c) < coefficientTolerance &&
      contribution < coefficientTolerance
    ) {
      return;
    }

    const magnitude = format(Math.abs(c));

    if (i === 0) {
      terms.push(c < 0 ? `−${magnitude}` : magnitude);
    } else {
      const variable = `x${i > 1 ? `^${i}` : ""}`;
      const coefficient =
        Math.abs(Math.abs(c) - 1) < coefficientTolerance
          ? ""
          : magnitude;

      terms.push(
        `${c < 0 ? " − " : " + "}${coefficient}${variable}`
      );
    }
  });

  return terms.length ? terms.join("") : "0";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
}

function format(value) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toPrecision(8)).toString() : "—";
}
