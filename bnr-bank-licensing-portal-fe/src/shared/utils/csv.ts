export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export type ReportFormat = 'csv' | 'excel' | 'pdf';

function escapeCsvValue(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(','),
  );

  return [header, ...body].join('\n');
}

function withExtension(filename: string, extension: string): string {
  return `${filename.replace(/\.[a-z0-9]+$/i, '')}.${extension}`;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, csv: string): void {
  downloadBlob(
    withExtension(filename, 'csv'),
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
  );
}

function escapeHtml(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadExcel<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const table = [
    '<table>',
    '<thead><tr>',
    ...columns.map((column) => `<th>${escapeHtml(column.header)}</th>`),
    '</tr></thead>',
    '<tbody>',
    ...rows.map((row) =>
      `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`,
    ),
    '</tbody>',
    '</table>',
  ].join('');

  downloadBlob(
    withExtension(filename, 'xls'),
    new Blob([table], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
  );
}

export async function downloadPdf<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
  title = 'Applications Report',
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.text(title, 14, 14);

  autoTable(doc, {
    startY: 20,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) =>
      columns.map((column) => {
        const value = column.value(row);
        return value === null || value === undefined ? '' : String(value);
      }),
    ),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(withExtension(filename, 'pdf'));
}
