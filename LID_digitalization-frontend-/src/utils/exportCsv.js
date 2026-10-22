/**
 * Exports data to a CSV file and triggers browser download.
 * @param {string[]} headers - Array of column header strings
 * @param {any[][]} rows - 2D array of row data
 * @param {string} filename - Output filename (without extension)
 */
export const exportToCSV = (headers, rows, filename) => {
  if (!rows || rows.length === 0) return;

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
