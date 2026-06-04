import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import Boom from '@hapi/boom';
import { IImportFileFormat } from '@domain/_interfaces/importExport.interface';

export interface ParsedFile {
  /** Source column headers in file order. */
  headers: string[];
  /** One object per data row, keyed by header. Values are raw strings (or null). */
  rows: Record<string, unknown>[];
}

function badRequest(message: string): Boom.Boom {
  return Boom.badRequest(message, { code: 'IEX4001' });
}

function normalizeHeader(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value).trim();
  }
  return '';
}

function parseCsvBuffer(buffer: Buffer): ParsedFile {
  // Strip a UTF-8 BOM so the first header is not prefixed with U+FEFF.
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const records = parseCsv<Record<string, unknown>>(text, {
    columns: (header: string[]) => header.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

async function parseXlsxBuffer(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  // exceljs accepts a Node Buffer for xlsx.load despite the ArrayBuffer typing.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = normalizeHeader(cell.value);
  });
  const cleanHeaders = headers.filter((h) => h && h.length > 0);

  const rows: Record<string, unknown>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      const value = cell.value;
      if (value !== null && value !== undefined && value !== '') hasValue = true;
      obj[header] = cellToString(value);
    });
    if (hasValue) rows.push(obj);
  });
  return { headers: cleanHeaders, rows };
}

function primitiveToString(value: string | number | boolean | bigint): string {
  return String(value);
}

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const obj = value as { text?: string; result?: unknown; hyperlink?: string };
    if (typeof obj.text === 'string') return obj.text;
    if (obj.result !== undefined) {
      const result = obj.result;
      if (
        typeof result === 'string' ||
        typeof result === 'number' ||
        typeof result === 'boolean' ||
        typeof result === 'bigint'
      ) {
        return primitiveToString(result);
      }
      return null;
    }
    if (typeof obj.hyperlink === 'string') return obj.hyperlink;
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return primitiveToString(value);
  }
  return null;
}

function parseJsonBuffer(buffer: Buffer): ParsedFile {
  let data: unknown;
  try {
    data = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw badRequest('File is not valid JSON');
  }
  if (!Array.isArray(data)) {
    throw badRequest('JSON import must be an array of objects');
  }
  const rows = data.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw badRequest('Each JSON entry must be an object');
    }
    return item as Record<string, unknown>;
  });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

export async function parseFile(format: IImportFileFormat, buffer: Buffer): Promise<ParsedFile> {
  switch (format) {
    case IImportFileFormat.CSV:
      return parseCsvBuffer(buffer);
    case IImportFileFormat.XLSX:
      return parseXlsxBuffer(buffer);
    case IImportFileFormat.JSON:
      return parseJsonBuffer(buffer);
    default:
      throw badRequest('Unsupported file format');
  }
}
