/**
 * Pure Erlang-B calculation layer.
 *
 * No DOM, browser, canvas, or UI dependencies.
 */

export const DEFAULT_ERROR_MESSAGES = Object.freeze({
  maxCircuits: 'Max Circuits Number must be a positive integer.',
  maxTraffic: 'Max Offered Traffic must be a finite number greater than 0.',
  minLossExponent: 'Min Erlang Loss exponent must be a positive integer.',
  trafficStep: 'Traffic Axis Step must be a finite number greater than 0.',
  trafficStepRange: 'Traffic Axis Step cannot exceed Max Offered Traffic.'
});

/**
 * Calculate Erlang-B loss probability for R circuits and offered traffic A.
 * The operation order intentionally mirrors the legacy Java recurrence.
 */
export function erlangB(circuits, offeredTraffic) {
  if (!Number.isInteger(circuits) || circuits < 0) {
    throw new RangeError('circuits must be an integer >= 0');
  }
  if (!Number.isFinite(offeredTraffic) || offeredTraffic < 0) {
    throw new RangeError('offeredTraffic must be finite and >= 0');
  }

  let probability = 1;
  for (let r = 1; r <= circuits; r += 1) {
    const temp = offeredTraffic * probability;
    probability = temp / (temp + r);
  }
  return probability;
}

/**
 * Validate the modernized public input contract.
 * Returns a stable object rather than throwing for ordinary user input.
 */
export function validateParameters(parameters) {
  const errors = {};

  if (!Number.isInteger(parameters?.maxCircuits) || parameters.maxCircuits < 1) {
    errors.maxCircuits = DEFAULT_ERROR_MESSAGES.maxCircuits;
  }

  if (!Number.isFinite(parameters?.maxTraffic) || parameters.maxTraffic <= 0) {
    errors.maxTraffic = DEFAULT_ERROR_MESSAGES.maxTraffic;
  }

  if (!Number.isInteger(parameters?.minLossExponent) || parameters.minLossExponent < 1) {
    errors.minLossExponent = DEFAULT_ERROR_MESSAGES.minLossExponent;
  }

  if (!Number.isFinite(parameters?.trafficStep) || parameters.trafficStep <= 0) {
    errors.trafficStep = DEFAULT_ERROR_MESSAGES.trafficStep;
  } else if (Number.isFinite(parameters?.maxTraffic) &&
             parameters.maxTraffic > 0 &&
             parameters.trafficStep > parameters.maxTraffic) {
    errors.trafficStep = DEFAULT_ERROR_MESSAGES.trafficStepRange;
  }

  return Object.freeze({
    valid: Object.keys(errors).length === 0,
    errors: Object.freeze(errors)
  });
}

/**
 * Generate the real traffic coordinates in [0, maxTraffic].
 * Each coordinate is derived from its integer index to avoid cumulative
 * floating-point addition. The maximum is included when exactly divisible.
 */
export function generateTrafficPoints(maxTraffic, trafficStep) {
  if (!Number.isFinite(maxTraffic) || maxTraffic <= 0) {
    throw new RangeError('maxTraffic must be finite and > 0');
  }
  if (!Number.isFinite(trafficStep) || trafficStep <= 0 || trafficStep > maxTraffic) {
    throw new RangeError('trafficStep must be finite, > 0, and <= maxTraffic');
  }

  const ratio = maxTraffic / trafficStep;
  const nearestInteger = Math.round(ratio);
  const integerTolerance = 4 * Number.EPSILON * Math.max(1, Math.abs(ratio));
  const stepCount = Math.abs(ratio - nearestInteger) <= integerTolerance
    ? nearestInteger
    : Math.floor(ratio);
  const count = stepCount + 1;
  const points = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const point = i * trafficStep;
    points[i] = Math.abs(point - maxTraffic) <= integerTolerance * Math.max(1, Math.abs(maxTraffic))
      ? maxTraffic
      : point;
  }

  return points;
}

/**
 * Calculate all curves for the supplied validated parameters.
 */
export function calculateObservations(parameters) {
  const validation = validateParameters(parameters);
  if (!validation.valid) {
    throw new RangeError(Object.values(validation.errors).join(' '));
  }

  const { maxCircuits, maxTraffic, minLossExponent, trafficStep } = parameters;
  const traffic = generateTrafficPoints(maxTraffic, trafficStep);
  const curves = new Array(maxCircuits);

  for (let circuits = 1; circuits <= maxCircuits; circuits += 1) {
    const probabilities = new Array(traffic.length);
    for (let i = 0; i < traffic.length; i += 1) {
      probabilities[i] = erlangB(circuits, traffic[i]);
    }
    curves[circuits - 1] = Object.freeze({ circuits, probabilities: Object.freeze(probabilities) });
  }

  return Object.freeze({
    parameters: Object.freeze({ maxCircuits, maxTraffic, minLossExponent, trafficStep }),
    traffic: Object.freeze(traffic),
    curves: Object.freeze(curves)
  });
}
