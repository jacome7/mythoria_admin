/**
 * Minimal CSV helpers with spreadsheet formula-injection protection (OWASP "CSV injection").
 * String cells that start with `=`, `+`, `-`, `@`, TAB or CR are prefixed with a single quote so
 * Excel / Sheets / LibreOffice treat them as text. Numbers and booleans are never prefixed.
 */

export type CsvCell = string | number | boolean | Date | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  const text = neutralizeFormula(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsvRow(cells: readonly CsvCell[]): string {
  return cells.map(escapeCsvCell).join(',');
}

/** Serializes a header + rows to CSV (CRLF line endings, trailing newline). */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [toCsvRow(header), ...rows.map(toCsvRow)].join('\r\n') + '\r\n';
}
