// Replaces the ~6 independently-duplicated pagination-meta blocks found
// across the codebase. Two shapes exist today: a basic one
// ({page, limit, total, totalPages}) and an extended one that also adds
// hasNext/hasPrev. This always returns the extended shape — callers using
// the basic shape can destructure only the fields they currently expose,
// since adding the two extra boolean fields is additive and does not
// remove or rename anything an existing response already returns.
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}
