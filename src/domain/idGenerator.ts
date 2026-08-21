// Replaces the ~9 independently-duplicated "count documents, zero-pad,
// prefix" ID-generation blocks found across the codebase (member IDs,
// family codes, certificate numbers, payment/receipt numbers, nikah
// numbers, property codes, admission numbers, employee IDs).
//
// Deliberately kept non-atomic: callers pass in a `count` they've already
// fetched (typically `Model.countDocuments(...)`), so this stays a pure,
// unit-testable function with no DB access of its own. This preserves the
// existing race-condition-prone behavior exactly — switching to an atomic
// Mongo counter/sequence is a real behavior/concurrency-safety change and
// is explicitly out of scope here (see migration plan, Task 3.1 risk notes).
export function generateSequentialId(
  prefix: string,
  count: number,
  options: { includeYear?: boolean; padWidth?: number } = {},
): string {
  const { includeYear = true, padWidth = 4 } = options;
  const sequence = String(count + 1).padStart(padWidth, '0');
  return includeYear ? `${prefix}-${new Date().getFullYear()}-${sequence}` : `${prefix}-${sequence}`;
}
