const path = require('path');
const fs = require('fs');

/**
 * Download a file from the server
 * Endpoint: GET /api/files/download?path=/uploads/...
 */
const downloadFile = (req, res) => {
  const { path: filePath, inline } = req.query;

  if (!filePath) {
    return res.status(400).json({ success: false, message: 'File path is required' });
  }

  // Prevent directory traversal attacks
  const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Resolve absolute path starting from the backend root directory
  // Assuming the uploads folder is located at backend/uploads
  const absolutePath = path.join(__dirname, '../../', normalizedPath);

  if (fs.existsSync(absolutePath)) {
    if (inline === 'true') {
      // Send file for inline viewing (preview in iframe) without Content-Disposition: attachment
      res.sendFile(absolutePath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ success: false, message: 'Error rendering file inline' });
        }
      });
    } else {
      // Send file as attachment for downloading
      res.download(absolutePath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ success: false, message: 'Error downloading file' });
        }
      });
    }
  } else {
    res.status(404).json({ success: false, message: 'File not found' });
  }
};

module.exports = {
  downloadFile
};
