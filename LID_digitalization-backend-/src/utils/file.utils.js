const fs = require('fs');
const path = require('path');

/**
 * Safely deletes a physical file from the uploads directory.
 * @param {string} fileUrl - The URL path stored in the database (e.g. "/uploads/po/sparepart/file.pdf")
 */
function deleteFile(fileUrl) {
  if (!fileUrl) return;

  try {
    // Convert URL path to absolute file system path
    // fileUrl is stored as "/uploads/po/..." — resolve relative to backend root
    const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
    const absolutePath = path.resolve(__dirname, '../../', relativePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`[FileCleanup] Deleted: ${absolutePath}`);
    }
  } catch (err) {
    // Log but don't throw — file cleanup should not block the delete operation
    console.warn(`[FileCleanup] Failed to delete file "${fileUrl}":`, err.message);
  }
}

/**
 * Deletes multiple files given an array of URL paths.
 * @param {string[]} fileUrls - Array of URL paths
 */
function deleteFiles(fileUrls) {
  for (const url of fileUrls) {
    deleteFile(url);
  }
}

module.exports = { deleteFile, deleteFiles };
