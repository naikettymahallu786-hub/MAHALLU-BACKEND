import { computeDateRange } from './dateRangeQuery';

describe('computeDateRange', () => {
  it('returns null when no date inputs are provided', () => {
    expect(computeDateRange()).toBeNull();
  });

  it('builds a $gte-only filter when only startDate is given', () => {
    const result = computeDateRange('2026-01-01');
    expect(result).toEqual({ $gte: new Date('2026-01-01') });
  });

  it('builds a $lte filter set to end-of-day when only endDate is given', () => {
    const result = computeDateRange(undefined, '2026-01-15');
    expect(result!.$gte).toBeUndefined();
    expect(result!.$lte).toEqual(new Date(2026, 0, 15, 23, 59, 59, 999));
  });

  it('builds both bounds when startDate and endDate are given', () => {
    const result = computeDateRange('2026-01-01', '2026-01-31');
    expect(result!.$gte).toEqual(new Date('2026-01-01'));
    expect(result!.$lte).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
  });

  it('startDate/endDate take precedence over year/month when both are given', () => {
    const result = computeDateRange('2026-01-01', undefined, '6', '2025');
    expect(result!.$gte).toEqual(new Date('2026-01-01'));
  });

  it('builds a full-month range when year and a specific month are given', () => {
    const result = computeDateRange(undefined, undefined, '3', '2026');
    expect(result).toEqual({
      $gte: new Date(2026, 2, 1),
      $lte: new Date(2026, 2, 31, 23, 59, 59, 999),
    });
  });

  it('builds a full-year range when year is given and month is "all"', () => {
    const result = computeDateRange(undefined, undefined, 'all', '2026');
    expect(result).toEqual({
      $gte: new Date(2026, 0, 1),
      $lte: new Date(2026, 11, 31, 23, 59, 59, 999),
    });
  });

  it('builds a full-year range when year is given and month is omitted', () => {
    const result = computeDateRange(undefined, undefined, undefined, '2026');
    expect(result).toEqual({
      $gte: new Date(2026, 0, 1),
      $lte: new Date(2026, 11, 31, 23, 59, 59, 999),
    });
  });
});
