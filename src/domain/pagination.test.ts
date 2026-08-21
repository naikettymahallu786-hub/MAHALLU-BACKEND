import { buildPaginationMeta } from './pagination';

describe('buildPaginationMeta', () => {
  it('computes totalPages, hasNext, and hasPrev for a middle page', () => {
    expect(buildPaginationMeta(2, 10, 25)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('hasPrev is false on page 1', () => {
    const meta = buildPaginationMeta(1, 10, 25);
    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(true);
  });

  it('hasNext is false on the last page', () => {
    const meta = buildPaginationMeta(3, 10, 25);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  it('totalPages is 0 when there are no results (matches existing Math.ceil(0/limit) behavior)', () => {
    const meta = buildPaginationMeta(1, 10, 0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });

  it('totalPages is exact when total divides evenly by limit', () => {
    expect(buildPaginationMeta(2, 10, 20).totalPages).toBe(2);
  });
});
