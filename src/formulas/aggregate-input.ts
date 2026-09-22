import { parseNumericText } from '../core/numeric';

/** 空行不参与；非空但不完整的配对行整行跳过，不改写原始文本。 */
export function parseAggregateRows(rows: string[][], width: number) {
  const columns: number[][] = Array.from({ length: width }, () => []);
  let empty = 0;
  let skipped = 0;
  let valid = 0;
  for (const row of rows) {
    const cells = Array.from({ length: width }, (_, i) => (row[i] ?? '').trim());
    if (cells.every(cell => cell === '')) { empty++; continue; }
    const parsed = cells.map(parseNumericText);
    if (parsed.some(cell => !cell.ok)) { skipped++; continue; }
    parsed.forEach((cell, i) => { if (cell.ok) columns[i].push(cell.value); });
    valid++;
  }
  return { columns, empty, skipped, valid };
}

/** String(number) 可往返到原浮点值，不能在此提前修约。 */
export function aggregateValueText(value: number): string {
  return String(value);
}
