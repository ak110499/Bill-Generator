import * as XLSX from 'xlsx';
import { ExtractedRow } from './geminiProcessor';

export function generateExcel(data: ExtractedRow[], filename: string = 'Extracted_Data.xlsx') {
  if (data.length === 0) return;

  // The data is already an array of objects with dynamic keys, so we can pass it directly.
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  XLSX.writeFile(workbook, filename);
}
