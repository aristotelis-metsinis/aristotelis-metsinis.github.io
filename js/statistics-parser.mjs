export function parseText(text, delimiterMode = "auto") {
  const rows = [];
  const errors = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("//")) continue;

    const delimiter = resolveDelimiter(raw, delimiterMode);
    const parts = delimiter === "whitespace"
      ? raw.split(/\s+/)
      : raw.split(delimiter).map((value) => value.trim());

    if (parts.length < 2) {
      errors.push({ line: index + 1, text: lines[index], reason: "Expected at least two columns." });
      continue;
    }

    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      // Permit a single header row when both fields are non-numeric.
      if (index === lines.findIndex((line) => line.trim()) && /[a-z]/i.test(parts[0] + parts[1])) continue;
      errors.push({ line: index + 1, text: lines[index], reason: "X and Y must be finite numbers." });
      continue;
    }
    rows.push({ x, y, sourceLine: index + 1 });
  }

  return { rows, errors, totalLines: lines.length };
}

function resolveDelimiter(line, mode) {
  if (mode !== "auto") return mode;
  if (line.includes(",")) return ",";
  if (line.includes(";")) return ";";
  if (line.includes("\t")) return "\t";
  return "whitespace";
}
