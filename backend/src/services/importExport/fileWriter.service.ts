import { stringify as stringifyCsv } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import { IImportFileFormat } from '@domain/_interfaces/importExport.interface';

export type CellValue = string | number | boolean | null | undefined;
export type ExportRow = Record<string, CellValue>;

const UTF8_BOM = '﻿';

/** Serializes rows to the requested format. Column order follows `headers`. */
export async function writeFile(
  format: IImportFileFormat,
  headers: string[],
  rows: ExportRow[],
): Promise<{ buffer: Buffer; ext: string }> {
  switch (format) {
    case IImportFileFormat.CSV:
      return { buffer: writeCsv(headers, rows), ext: 'csv' };
    case IImportFileFormat.XLSX:
      return { buffer: await writeXlsx(headers, rows), ext: 'xlsx' };
    case IImportFileFormat.JSON:
      return { buffer: writeJson(headers, rows), ext: 'json' };
    default:
      throw new Error(`Unsupported export format: ${String(format)}`);
  }
}

function writeCsv(headers: string[], rows: ExportRow[]): Buffer {
  const records = rows.map((row) => headers.map((h) => normalize(row[h])));
  const csv = stringifyCsv([headers, ...records]);
  // Prepend a BOM so Excel opens UTF-8 cleanly.
  return Buffer.from(UTF8_BOM + csv, 'utf8');
}

async function writeXlsx(headers: string[], rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Export');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(headers.map((h) => normalize(row[h])));
  }
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

function writeJson(headers: string[], rows: ExportRow[]): Buffer {
  const objects = rows.map((row) => {
    const obj: Record<string, CellValue> = {};
    for (const h of headers) obj[h] = row[h] ?? null;
    return obj;
  });
  return Buffer.from(JSON.stringify(objects, null, 2), 'utf8');
}

function normalize(value: CellValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}
