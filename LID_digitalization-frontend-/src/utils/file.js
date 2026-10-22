/**
 * Generates the full URL for a server-side file path.
 * Uses VITE_API_BASE_URL or derives the base host from VITE_API_URL.
 *
 * @param {string|null} path - The relative file path from the server (e.g., "/uploads/file.pdf")
 * @returns {string|null} The full URL to access the file, or null if path is falsy.
 */
export const getFileUrl = (path) => {
  if (!path) return null;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return `${apiUrl}/files/download?path=${encodeURIComponent(path)}`;
};

/**
 * Generates URL for viewing/embedding files inline (without triggering file download).
 */
export const getFileViewUrl = (path) => {
  if (!path) return null;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return `${apiUrl}/files/download?path=${encodeURIComponent(path)}&inline=true`;
};
