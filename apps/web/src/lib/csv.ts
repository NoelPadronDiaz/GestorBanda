/** Exportación CSV compatible con Excel en español (separador «;», BOM UTF-8) y lectura de extractos. */

type Cell = string | number | null | undefined;

function quote(value: Cell): string {
  if (value === null || value === undefined) return '""';
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: Cell[][]): void {
  const csv = '\uFEFFsep=;\r\n' + rows.map((row) => row.map(quote).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Céntimos → número en euros para la hoja de cálculo. */
export const csvEuros = (cents: number) => Math.round(cents) / 100;

/** Interpreta un CSV de banco: detecta «;», «,» o tabulador y respeta comillas. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '').replace(/^sep=[^\r\n]*[\r\n]+/i, '');
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const separators = [';', ',', '\t'];
  const separator = separators
    .map((sep) => ({ sep, count: firstLine.split(sep).length }))
    .sort((a, b) => b.count - a.count)[0].sep;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
      continue;
    }
    if (!quoted && char === separator) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

/** Fecha de extracto (DD/MM/AAAA, DD-MM-AAAA o AAAA-MM-DD) → AAAA-MM-DD, o null si no es válida. */
export function parseBankDate(value: string): string | null {
  const text = value.trim();
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text);
  let parts: [number, number, number] | null = match ? [+match[1], +match[2], +match[3]] : null;
  if (!parts) {
    match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text);
    if (match) parts = [+match[3], +match[2], +match[1]];
  }
  if (!parts) return null;
  const [y, m, d] = parts;
  const dateValue = new Date(Date.UTC(y, m - 1, d));
  if (
    dateValue.getUTCFullYear() !== y ||
    dateValue.getUTCMonth() !== m - 1 ||
    dateValue.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
