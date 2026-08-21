// Characterization test for calculateNextDueDate. Originally run against its
// pre-move location (src/routes/family.routes.ts) to establish a passing
// baseline before Task 1.1 moved the implementation here — all assertions
// below are unchanged from that baseline run.
import { calculateNextDueDate } from './billing';

describe('calculateNextDueDate', () => {
  it('returns undefined when type is undefined', () => {
    expect(calculateNextDueDate(undefined, 15, 6, new Date('2026-08-18'))).toBeUndefined();
  });

  it('returns undefined when type is "none"', () => {
    expect(calculateNextDueDate('none', 15, 6, new Date('2026-08-18'))).toBeUndefined();
  });

  describe('monthly', () => {
    it('returns this month\'s due day when it has not passed yet', () => {
      const result = calculateNextDueDate('monthly', 25, 1, new Date('2026-08-18'));
      expect(result).toEqual(new Date(2026, 7, 25));
    });

    it('rolls over to next month when the due day already passed', () => {
      const result = calculateNextDueDate('monthly', 10, 1, new Date('2026-08-18'));
      expect(result).toEqual(new Date(2026, 8, 10));
    });

    it('treats the due day equal to "now" as already passed (candidate <= now)', () => {
      const result = calculateNextDueDate('monthly', 18, 1, new Date('2026-08-18'));
      expect(result).toEqual(new Date(2026, 8, 18));
    });

    it('clamps day above 28 down to 28', () => {
      const result = calculateNextDueDate('monthly', 31, 1, new Date('2026-08-01'));
      expect(result).toEqual(new Date(2026, 7, 28));
    });

    it('clamps day below 1 up to 1', () => {
      const result = calculateNextDueDate('monthly', 0, 1, new Date('2026-08-15'));
      expect(result).toEqual(new Date(2026, 8, 1));
    });

    it('defaults day to 1 when falsy/omitted', () => {
      const result = calculateNextDueDate('monthly', undefined as unknown as number, 1, new Date('2026-08-15'));
      expect(result).toEqual(new Date(2026, 8, 1));
    });

    it('uses the current date as the base when lastPaymentDate is omitted', () => {
      const before = new Date();
      const result = calculateNextDueDate('monthly', 1)!;
      expect(result.getTime()).toBeGreaterThan(before.getTime() - 5000);
    });
  });

  describe('yearly', () => {
    it('returns this year\'s due date when it has not passed yet', () => {
      const result = calculateNextDueDate('yearly', 20, 12, new Date('2026-08-18'));
      expect(result).toEqual(new Date(2026, 11, 20));
    });

    it('rolls over to next year when the due date already passed', () => {
      const result = calculateNextDueDate('yearly', 20, 1, new Date('2026-08-18'));
      expect(result).toEqual(new Date(2027, 0, 20));
    });

    it('clamps month above 12 down to 12', () => {
      const result = calculateNextDueDate('yearly', 15, 15, new Date('2026-01-01'));
      expect(result).toEqual(new Date(2026, 11, 15));
    });

    it('clamps month below 1 up to 1', () => {
      const result = calculateNextDueDate('yearly', 15, 0, new Date('2026-06-01'));
      expect(result).toEqual(new Date(2027, 0, 15));
    });

    it('clamps day above 28 down to 28', () => {
      const result = calculateNextDueDate('yearly', 31, 6, new Date('2026-01-01'));
      expect(result).toEqual(new Date(2026, 5, 28));
    });
  });
});
