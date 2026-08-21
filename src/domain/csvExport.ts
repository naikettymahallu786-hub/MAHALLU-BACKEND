// Unifies the 3 independent CSV-export implementations found in
// _remaining.ts's report handlers (escapeCSV), family.routes.ts
// (reports/recurring), and payment.routes.ts (reports/finance) onto the
// report-routes' RFC-4180-style approach: only quote a field when it
// contains a comma, quote, or newline, and treat null/undefined as an
// empty string rather than crashing.
//
// User-approved choice (over the other two implementations' "always quote
// string fields, unquoted numbers" style): this changes the exact output
// bytes of family.routes.ts's and payment.routes.ts's CSV exports once
// each of those domains adopts this helper in its own Phase 4 migration
// task — e.g. a plain name like `Alice` will no longer be wrapped in
// quotes — and fixes a real latent bug where those two implementations
// throw a TypeError on a null/undefined string field (e.g. a missing
// payer name or description).
export function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Matches the exact existing convention: headers are joined raw
// (unescaped), only row values pass through escapeCSVField.
export function buildCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(','), ...rows.map((row) => row.map(escapeCSVField).join(','))];
  return lines.join('\n');
}
