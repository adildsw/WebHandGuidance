import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const toCSV = <T>(rows: T[], keys: (keyof T)[]): string => {
  if (!rows.length) return '';

  const headers = keys.map(String);
  const csvRows = [
    headers.join(','), // Header Row
    ...rows.map((row) =>
      keys
        .map((field) => {
          const val = row[field];
          if (val == null) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    ),
  ];
  return csvRows.join('\n');
};

export const downloadZip = async (filename:string, data: string, rawData: string, taskData: string) => {
  const zip = new JSZip();

  zip.file('data_mm.csv', data);
  zip.file('data_px.csv', rawData);
  zip.file('task.json', taskData);

  const content = await zip.generateAsync({ type: 'blob' });

  saveAs(content, filename + '.zip');
};
