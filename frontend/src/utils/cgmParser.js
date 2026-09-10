/**
 * CGM Data Import & CSV Parser Utility (PS-I02 Requirement)
 *
 * Supports CSV exports from Dexcom, FreeStyle Libre, and generic CSV formats.
 * Validates timestamp and glucose values, and formats chronological sequences
 * for time-series forecasting with the LSTM prediction model.
 */

/**
 * Parse CSV text into validated CGM time-series readings.
 * @param {string} csvText - Raw CSV file string
 * @returns {{ success: boolean, readings: Array<{ timestamp: string, glucose: number, timeStr: string }>, error?: string, summary?: object }}
 */
export function parseCgmCsv(csvText) {
  if (!csvText || typeof csvText !== "string" || !csvText.trim()) {
    return { success: false, readings: [], error: "CSV file is empty or unreadable." };
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { success: false, readings: [], error: "CSV must contain a header row and at least one data row." };
  }

  // Detect header row (first line or line with 'glucose' / 'time')
  let headerIndex = 0;
  let headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  const hasGlucoseHeader = headers.some((h) => h.includes("glucose") || h.includes("value") || h.includes("reading"));
  const hasTimeHeader = headers.some((h) => h.includes("time") || h.includes("date"));

  // If line 0 is metadata (like Dexcom exports with preamble), search first 15 lines
  if (!hasGlucoseHeader || !hasTimeHeader) {
    for (let i = 1; i < Math.min(15, lines.length); i++) {
      const candidate = lines[i].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
      if (
        candidate.some((h) => h.includes("glucose") || h.includes("value") || h.includes("reading") || h.includes("historic")) &&
        candidate.some((h) => h.includes("time") || h.includes("date"))
      ) {
        headerIndex = i;
        headers = candidate;
        break;
      }
    }
  }

  // Find column indexes
  let timeColIdx = headers.findIndex((h) => h.includes("timestamp") || h.includes("date time") || h === "time" || h === "date");
  if (timeColIdx === -1) {
    timeColIdx = headers.findIndex((h) => h.includes("time") || h.includes("date"));
  }

  let glucoseColIdx = headers.findIndex((h) => h.includes("glucose value") || h.includes("historic glucose") || h === "glucose" || h === "value");
  if (glucoseColIdx === -1) {
    glucoseColIdx = headers.findIndex((h) => h.includes("glucose") || h.includes("reading") || h.includes("value"));
  }

  // Fallback: if columns are not named, assume col 0 is time, col 1 is glucose
  if (timeColIdx === -1 && glucoseColIdx === -1) {
    timeColIdx = 0;
    glucoseColIdx = 1;
  } else if (glucoseColIdx === -1) {
    glucoseColIdx = timeColIdx === 0 ? 1 : 0;
  } else if (timeColIdx === -1) {
    timeColIdx = glucoseColIdx === 0 ? 1 : 0;
  }

  const rawReadings = [];
  let skippedRows = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""));
    if (row.length <= Math.max(timeColIdx, glucoseColIdx)) {
      skippedRows++;
      continue;
    }

    const timeRaw = row[timeColIdx];
    const glucoseRaw = parseFloat(row[glucoseColIdx]);

    if (isNaN(glucoseRaw)) {
      skippedRows++;
      continue;
    }

    // Physiological validity check (20 - 500 mg/dL)
    if (glucoseRaw < 20 || glucoseRaw > 500) {
      skippedRows++;
      continue;
    }

    const dateObj = new Date(timeRaw);
    const validDate = !isNaN(dateObj.getTime());

    rawReadings.push({
      timestamp: validDate ? dateObj.toISOString() : timeRaw,
      timeMs: validDate ? dateObj.getTime() : i,
      glucose: Math.round(glucoseRaw * 10) / 10,
      timeStr: validDate ? dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : `Reading ${i}`,
    });
  }

  if (rawReadings.length === 0) {
    return {
      success: false,
      readings: [],
      error: "No valid numeric glucose readings found in the file. Ensure values are between 20 and 500 mg/dL.",
    };
  }

  // Sort chronologically
  rawReadings.sort((a, b) => a.timeMs - b.timeMs);

  const cleanReadings = rawReadings.map(({ timestamp, glucose, timeStr }) => ({
    timestamp,
    glucose,
    timeStr,
  }));

  const values = cleanReadings.map((r) => r.glucose);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const avgVal = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const latest = cleanReadings[cleanReadings.length - 1].glucose;

  return {
    success: true,
    readings: cleanReadings,
    summary: {
      total: cleanReadings.length,
      latest,
      min: minVal,
      max: maxVal,
      avg: avgVal,
      skipped: skippedRows,
    },
  };
}

/**
 * Demo preset 24-point CGM traces (5-minute intervals = 2 hours)
 * ready for 1-click evaluation of the LSTM model.
 */
export const DEMO_CGM_TRACES = {
  stable: {
    name: "Stable Glucose Trace (In Range)",
    desc: "Steady euglycemic trend (~110–125 mg/dL) over 2 hours.",
    readings: [
      112, 114, 115, 113, 116, 118,
      117, 119, 120, 118, 122, 121,
      123, 122, 120, 119, 118, 117,
      119, 120, 121, 120, 122, 121
    ],
  },
  postMeal: {
    name: "Post-Meal Rise (Carb Intake)",
    desc: "Active post-prandial absorption rising from 110 up to 187 mg/dL.",
    readings: [
      110, 112, 115, 118, 122, 126,
      130, 135, 141, 146, 152, 157,
      162, 166, 170, 173, 175, 178,
      180, 182, 183, 185, 186, 187
    ],
  },
  hypoDropping: {
    name: "⚠️ Impending Hypoglycemia (Dropping Trend)",
    desc: "Rapidly declining curve dropping toward hypoglycemia (<70 mg/dL).",
    readings: [
      95, 90, 85, 80, 75, 70, 65, 60,
      56, 53, 50, 48, 46, 44, 42, 40,
      39, 38, 37, 36, 35, 34, 33, 30
    ],
  },
};
