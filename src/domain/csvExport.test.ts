import { escapeCSVField, buildCSV } from './csvExport';

describe('escapeCSVField', () => {
  it('returns an empty string for null and undefined', () => {
    expect(escapeCSVField(null)).toBe('');
    expect(escapeCSVField(undefined)).toBe('');
  });

  it('leaves plain values unquoted', () => {
    expect(escapeCSVField('Alice')).toBe('Alice');
    expect(escapeCSVField(42)).toBe('42');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCSVField('Kochi, Kerala')).toBe('"Kochi, Kerala"');
  });

  it('quotes and doubles internal quotes', () => {
    expect(escapeCSVField('She said "hi"')).toBe('"She said ""hi"""');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes a value containing a carriage return', () => {
    expect(escapeCSVField('line1\rline2')).toBe('"line1\rline2"');
  });
});

describe('buildCSV', () => {
  it('joins headers raw (unescaped) and rows with escaped fields', () => {
    const csv = buildCSV(
      ['Name', 'Amount'],
      [
        ['Alice', 100],
        ['Bob, Jr.', 200],
        [null, 300],
      ],
    );
    expect(csv).toBe('Name,Amount\nAlice,100\n"Bob, Jr.",200\n,300');
  });

  it('does not throw when a row field is null or undefined (fixes the pre-existing crash in the always-quote implementations)', () => {
    expect(() => buildCSV(['Description'], [[null], [undefined]])).not.toThrow();
    expect(buildCSV(['Description'], [[null], [undefined]])).toBe('Description\n\n');
  });
});
