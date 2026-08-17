/**
 * Pure chart-model functions for the Erlang B logarithmic plot.
 * No DOM, SVG, Canvas, or CSS dependencies.
 */

function formatPowerOfTenLabel(exponent) {
  if (exponent === 0) {
    return '1';
  }

  const superscriptDigits = {
    0: '⁰',
    1: '¹',
    2: '²',
    3: '³',
    4: '⁴',
    5: '⁵',
    6: '⁶',
    7: '⁷',
    8: '⁸',
    9: '⁹'
  };

  const superscriptExponent = String(exponent)
    .split('')
    .map(digit => superscriptDigits[digit])
    .join('');

  return `10⁻${superscriptExponent}`;
}

export function createLogScale(minLossExponent) {
  if (!Number.isInteger(minLossExponent) || minLossExponent < 1) {
    throw new RangeError('minLossExponent must be an integer >= 1.');
  }

  const minimumProbability = 10 ** (-minLossExponent);
  const maximumLog = 0;
  const minimumLog = -minLossExponent;

  return {
    minimumProbability,
    maximumProbability: 1,
    minLossExponent,
    toNormalizedY(probability) {
      if (!Number.isFinite(probability) || probability <= 0) return null;
      const logProbability = Math.log10(probability);
      if (logProbability <= minimumLog) return 1;
      if (logProbability >= maximumLog) return 0;
      return (maximumLog - logProbability) / minLossExponent;
    },
    clipProbability(probability) {
      if (!Number.isFinite(probability) || probability <= 0) return minimumProbability;
      return Math.min(1, Math.max(minimumProbability, probability));
    }
  };
}

export function createChartModel(result) {
  if (!result || !Array.isArray(result.traffic) || !Array.isArray(result.curves)) {
    throw new TypeError('A valid calculation result is required.');
  }

  const { minLossExponent, maxTraffic } = result.parameters ?? {};
  const scale = createLogScale(minLossExponent);
  const xMaximum = Number.isFinite(maxTraffic) && maxTraffic > 0
    ? maxTraffic
    : (result.traffic.at(-1) || 1);

  const ticks = Array.from({ length: minLossExponent + 1 }, (_, exponent) => ({
    exponent,
    probability: 10 ** (-exponent),
    normalizedY: exponent / minLossExponent,
    label: formatPowerOfTenLabel(exponent)
  }));

  const curves = result.curves.map((curve) => ({
    circuits: curve.circuits,
    points: result.traffic.map((traffic, index) => {
      const probability = curve.probabilities[index];
      return {
        traffic,
        probability,
        normalizedX: Math.min(1, Math.max(0, traffic / xMaximum)),
        normalizedY: scale.toNormalizedY(probability),
        visible: Number.isFinite(probability) && probability > 0 && probability >= scale.minimumProbability
      };
    })
  }));

  return {
    minLossExponent,
    minimumProbability: scale.minimumProbability,
    maximumTraffic: xMaximum,
    ticks,
    curves
  };
}
