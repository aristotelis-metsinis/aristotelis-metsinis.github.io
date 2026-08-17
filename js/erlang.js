import {
  calculateObservations,
  validateParameters
} from './erlang-calculator.mjs';
import { renderChartSvg } from './erlang-chart-renderer.mjs';

const form = document.querySelector('#parameters-form');
const resetButton = document.querySelector('#reset-button');
const statusMessage = document.querySelector('#status-message');
const resultsSummary = document.querySelector('#results-summary');
const trafficPointCount = document.querySelector('#traffic-point-count');
const curveCount = document.querySelector('#curve-count');
const yAxisMinimum = document.querySelector('#y-axis-minimum');
const chartShell = document.querySelector('#chart-shell');

const fields = {
  maxCircuits: document.querySelector('#max-circuits'),
  maxTraffic: document.querySelector('#max-traffic'),
  minLossExponent: document.querySelector('#min-loss-exponent'),
  trafficStep: document.querySelector('#traffic-step')
};

const errorElements = {
  maxCircuits: document.querySelector('#max-circuits-error'),
  maxTraffic: document.querySelector('#max-traffic-error'),
  minLossExponent: document.querySelector('#min-loss-exponent-error'),
  trafficStep: document.querySelector('#traffic-step-error')
};

function readNumberInput(field) {
  const value = field.value.trim();
  return value === '' ? NaN : Number(value);
}

function readParameters() {
  return {
    maxCircuits: readNumberInput(fields.maxCircuits),
    maxTraffic: readNumberInput(fields.maxTraffic),
    minLossExponent: readNumberInput(fields.minLossExponent),
    trafficStep: readNumberInput(fields.trafficStep)
  };
}

function clearErrors() {
  for (const key of Object.keys(fields)) {
    fields[key].removeAttribute('aria-invalid');
    errorElements[key].textContent = '';
  }
}

function showErrors(errors) {
  clearErrors();
  for (const [key, message] of Object.entries(errors)) {
    fields[key].setAttribute('aria-invalid', 'true');
    errorElements[key].textContent = message;
  }
}

function setStatus(message = '', state = '') {
  statusMessage.textContent = message;
  if (state) statusMessage.dataset.state = state;
  else delete statusMessage.dataset.state;
}

function clearResults() {
  resultsSummary.textContent = 'Enter parameters and select Calculate.';
  trafficPointCount.textContent = '—';
  curveCount.textContent = '—';
  yAxisMinimum.textContent = '—';
  chartShell.replaceChildren();
}

function createChartTooltip(chartShell) {
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.hidden = true;

  chartShell.appendChild(tooltip);
  return tooltip;
}

function formatTooltipProbability(probability) {
  return Number(probability).toFixed(6);
}

function formatTooltipTraffic(traffic) {
  return Number(traffic).toString();
}

function showChartTooltip(tooltip, pointElement, chartShell) {
  const circuits = pointElement.dataset.circuits;
  const traffic = Number(pointElement.dataset.traffic);
  const probability = Number(pointElement.dataset.probability);

  tooltip.innerHTML = `
    <div><span>Circuits:</span> <strong>${circuits}</strong></div>
    <div><span>Traffic:</span> <strong>${formatTooltipTraffic(traffic)} Erlangs</strong></div>
    <div><span>Loss probability:</span> <strong>${formatTooltipProbability(probability)}</strong></div>
  `;

  tooltip.hidden = false;
  tooltip.setAttribute('aria-hidden', 'false');

  positionChartTooltip(tooltip, pointElement, chartShell);
}

function positionChartTooltip(tooltip, pointElement, chartShell) {
  const shellRect = chartShell.getBoundingClientRect();
  const pointRect = pointElement.getBoundingClientRect();

  const gap = 10;

  let left = pointRect.left - shellRect.left + pointRect.width / 2;
  let top = pointRect.top - shellRect.top - gap;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  const tooltipRect = tooltip.getBoundingClientRect();

  if (tooltipRect.left < shellRect.left) {
    left += shellRect.left - tooltipRect.left + gap;
  } else if (tooltipRect.right > shellRect.right) {
    left -= tooltipRect.right - shellRect.right + gap;
  }

  if (tooltipRect.top < shellRect.top) {
    top = pointRect.bottom - shellRect.top + gap;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideChartTooltip(tooltip) {
  tooltip.hidden = true;
  tooltip.setAttribute('aria-hidden', 'true');
}

function attachChartTooltip(chartShell) {
  const svg = chartShell.querySelector('.erlang-chart');

  if (!svg) {
    return;
  }

  const tooltip = createChartTooltip(chartShell);
  const pointElements = svg.querySelectorAll('.chart-point-hit-area');

  for (const pointElement of pointElements) {
    pointElement.addEventListener('pointerenter', () => {
      showChartTooltip(tooltip, pointElement, chartShell);
    });

    pointElement.addEventListener('pointermove', () => {
      positionChartTooltip(tooltip, pointElement, chartShell);
    });

    pointElement.addEventListener('pointerleave', () => {
      hideChartTooltip(tooltip);
    });
  }

  svg.addEventListener('pointerleave', () => {
    hideChartTooltip(tooltip);
  });
}

function renderSummary(result) {
  const { maxCircuits, maxTraffic, minLossExponent, trafficStep } = result.parameters;
  resultsSummary.textContent = `Calculated ${maxCircuits} Erlang B curves from 0 to ${maxTraffic} Erlangs using a ${trafficStep} traffic step.`;
  trafficPointCount.textContent = String(result.traffic.length);
  curveCount.textContent = String(result.curves.length);
  yAxisMinimum.textContent = `1e-${minLossExponent}`;

  chartShell.innerHTML = renderChartSvg(result);
  attachChartTooltip(chartShell);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const parameters = readParameters();
  const validation = validateParameters(parameters);
  if (!validation.valid) {
    showErrors(validation.errors);
    setStatus('Please correct the highlighted parameters.', 'error');
    return;
  }

  try {
    const result = calculateObservations(parameters);
    clearErrors();
    renderSummary(result);
    setStatus('Calculation completed successfully.', 'success');
  } catch (error) {
    clearResults();
    setStatus(error instanceof Error ? error.message : 'Calculation failed.', 'error');
  }
});

resetButton.addEventListener('click', () => {
  form.reset();
  clearErrors();
  clearResults();
  setStatus();
});
