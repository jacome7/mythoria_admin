import { escapeCsvCell, toCsv, toCsvRow } from '@/lib/csv';

describe('csv helpers', () => {
  it('passes plain values through and renders empties', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(-3.5)).toBe('-3.5');
    expect(escapeCsvCell(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z');
  });

  it.each(['=SUM(A1)', '+1', '-1+2', '@cmd', '\tTabbed', '\rCarriage'])(
    'neutralizes formula-looking string %j',
    (value) => {
      expect(escapeCsvCell(value).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('quotes and escapes commas, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('combines formula protection with quoting', () => {
    expect(escapeCsvCell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });

  it('serializes header and rows with CRLF', () => {
    expect(toCsvRow(['a', 1, null])).toBe('a,1,');
    expect(toCsv(['h1', 'h2'], [['x', '-y']])).toBe("h1,h2\r\nx,'-y\r\n");
  });
});
