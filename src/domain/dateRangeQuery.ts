// Replaces the 3 independently-duplicated date-range-computation blocks
// found in _remaining.ts's report handlers, family.routes.ts, and
// payment.routes.ts. Verified byte-identical logic in all 3 (same
// startDate/endDate/month/year precedence, same end-of-day/end-of-month
// math) — only how each caller *applies* the resulting range to a filter
// differs (single field vs. an $or across multiple date fields), which
// stays at the call site rather than being folded into this helper.
export interface DateRangeFilter {
  $gte?: Date;
  $lte?: Date;
}

export function computeDateRange(
  startDate?: string,
  endDate?: string,
  month?: string,
  year?: string,
): DateRangeFilter | null {
  if (startDate || endDate) {
    const filter: DateRangeFilter = {};
    if (startDate) filter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.$lte = end;
    }
    return filter;
  }

  if (year) {
    const yr = parseInt(year);
    if (month && month !== 'all') {
      const m = parseInt(month) - 1;
      const start = new Date(yr, m, 1);
      const end = new Date(yr, m + 1, 0, 23, 59, 59, 999);
      return { $gte: start, $lte: end };
    }
    const start = new Date(yr, 0, 1);
    const end = new Date(yr, 11, 31, 23, 59, 59, 999);
    return { $gte: start, $lte: end };
  }

  return null;
}
