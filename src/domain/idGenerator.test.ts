import { generateSequentialId } from './idGenerator';

describe('generateSequentialId', () => {
  it('includes the current year and pads to the default width of 4 by default', () => {
    const year = new Date().getFullYear();
    expect(generateSequentialId('MHL', 0)).toBe(`MHL-${year}-0001`);
    expect(generateSequentialId('MHL', 41)).toBe(`MHL-${year}-0042`);
  });

  it('matches the exact member ID scheme (MHL-{year}-{4})', () => {
    const year = new Date().getFullYear();
    expect(generateSequentialId('MHL', 3, { padWidth: 4 })).toBe(`MHL-${year}-0004`);
  });

  it('matches the exact family code scheme (FAM-{4}, no year)', () => {
    expect(generateSequentialId('FAM', 3, { includeYear: false, padWidth: 4 })).toBe('FAM-0004');
  });

  it('matches the exact certificate number scheme (CERT-{year}-{5})', () => {
    const year = new Date().getFullYear();
    expect(generateSequentialId('CERT', 3, { padWidth: 5 })).toBe(`CERT-${year}-00004`);
  });

  it('matches the exact payment/receipt number schemes (PAY-/RCP-{year}-{6})', () => {
    const year = new Date().getFullYear();
    expect(generateSequentialId('PAY', 3, { padWidth: 6 })).toBe(`PAY-${year}-000004`);
    expect(generateSequentialId('RCP', 3, { padWidth: 6 })).toBe(`RCP-${year}-000004`);
  });

  it('matches the exact nikah number scheme (NKH-{year}-{4})', () => {
    const year = new Date().getFullYear();
    expect(generateSequentialId('NKH', 3, { padWidth: 4 })).toBe(`NKH-${year}-0004`);
  });

  it('matches the exact property code scheme (PROP-{4}, no year)', () => {
    expect(generateSequentialId('PROP', 3, { includeYear: false, padWidth: 4 })).toBe('PROP-0004');
  });

  it('matches the exact admission number scheme (STD-{year}-{4})', () => {
    const year = new Date().getFullYear();
    expect(generateSequentialId('STD', 3, { padWidth: 4 })).toBe(`STD-${year}-0004`);
  });

  it('matches the exact employee ID scheme (EMP-{4}, no year)', () => {
    expect(generateSequentialId('EMP', 3, { includeYear: false, padWidth: 4 })).toBe('EMP-0004');
  });

  it('does not truncate a sequence number wider than padWidth', () => {
    expect(generateSequentialId('PROP', 12345, { includeYear: false, padWidth: 4 })).toBe('PROP-12346');
  });
});
