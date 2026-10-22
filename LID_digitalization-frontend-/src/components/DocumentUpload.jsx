import React, { useState, useEffect } from 'react';
import { Upload, Button, message, Tag, Space, Modal, Input, ConfigProvider } from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { uploadDocument, renameDocument } from '../services/po.service';
import { getFileUrl } from '../utils/file';

const DocumentUpload = ({
  poId,
  poType,
  documentType,
  poNumber,
  value,
  onChange,
  label,
  disabled,
  multiple = false,
  promptFileName = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [customFileName, setCustomFileName] = useState('');

  // Rename state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renamingFileUrl, setRenamingFileUrl] = useState(null);
  const [newRenameFileName, setNewRenameFileName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Helper to normalize value to string array
  const normalizeFileList = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (e) {
          // ignore parse error
        }
      }
      // handle comma separated or single string
      if (trimmed.includes(',')) {
        return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [trimmed];
    }
    return [];
  };

  const [internalFiles, setInternalFiles] = useState(() => normalizeFileList(value));

  useEffect(() => {
    const normalized = normalizeFileList(value);
    // Only update if normalized value is strictly different from internal state
    if (JSON.stringify(normalized) !== JSON.stringify(internalFiles)) {
      setInternalFiles(normalized);
    }
  }, [value]);

  const doUpload = async (file, customName = null) => {
    setUploading(true);

    const formData = new FormData();
    formData.append('poType', poType);
    formData.append('documentType', documentType);
    if (poNumber) formData.append('poNumber', poNumber);
    if (customName) formData.append('customFileName', customName);
    formData.append('file', file);

    try {
      const response = await uploadDocument(poId, formData);

      message.success(`${customName || file.name} berhasil diunggah.`);

      if (multiple) {
        setInternalFiles((prev) => {
          const updated = !prev.includes(response.fileUrl)
            ? [...prev, response.fileUrl]
            : prev;
          if (onChange) {
            onChange(updated);
          }
          return updated;
        });
      } else {
        if (onChange) {
          onChange(response.fileUrl);
        }
      }

      return response;
    } catch (err) {
      message.error(
        'Upload failed: ' + (err.response?.data?.error || err.message)
      );
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleBeforeUpload = (file) => {
    // validate file size < 15MB
    const isLt15M = file.size / 1024 / 1024 < 15;
    if (!isLt15M) {
      message.error('File must be smaller than 15MB!');
      return Upload.LIST_IGNORE;
    }

    // validate format pdf
    if (file.type !== 'application/pdf') {
      message.error('You can only upload PDF files!');
      return Upload.LIST_IGNORE;
    }

    if (promptFileName) {
      setPendingFile(file);
      setCustomFileName('');
      setIsNameModalOpen(true);
      return false; // Stop auto-upload, wait for modal confirm
    }

    return true; // Proceed with customRequest
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;
    try {
      const nameToSubmit = customFileName ? customFileName.trim() : '';
      await doUpload(pendingFile, nameToSubmit);
      setIsNameModalOpen(false);
      setPendingFile(null);
      setCustomFileName('');
    } catch {
      // error handled in doUpload
    }
  };

  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const response = await doUpload(file);
      onSuccess(response, file);
    } catch (err) {
      onError(err);
    }
  };

  const getFileName = (path) => {
    if (!path) return '';

    const cleanPath = path.split('?')[0];
    const parts = cleanPath.split('/');
    const fileName = parts[parts.length - 1];

    try {
      return decodeURIComponent(fileName);
    } catch {
      return fileName;
    }
  };

  const truncateFileName = (fileName, maxLength = 15) => {
    if (!fileName) return '';

    if (fileName.length <= maxLength) {
      return fileName;
    }

    return `${fileName.slice(0, maxLength)}...`;
  };

  const handleDeleteFile = (fileUrl) => {
    if (disabled) return;
    setInternalFiles((prev) => {
      const updated = prev.filter((url) => url !== fileUrl);
      if (onChange) {
        onChange(updated);
      }
      return updated;
    });
  };

  const renderNameModal = () => {
    if (!promptFileName) return null;
    return (
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-600">
            <UploadOutlined />
            <span>Beri Nama Dokumen</span>
          </div>
        }
        open={isNameModalOpen}
        onOk={handleConfirmUpload}
        onCancel={() => {
          setIsNameModalOpen(false);
          setPendingFile(null);
          setCustomFileName('');
        }}
        confirmLoading={uploading}
        okText="Unggah Dokumen"
        cancelText="Batal"
        centered
        width={450}
        destroyOnClose
      >
        <ConfigProvider componentDisabled={false}>
          <div className="py-2 space-y-3">
            <p className="text-xs text-gray-500 m-0">
              Tentukan nama dokumen agar mudah diidentifikasi saat diunduh:
            </p>
            <Input
              placeholder="Contoh: Timesheet_Teknisi_Budi (Opsional)"
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              addonAfter=".pdf"
              autoFocus
              disabled={false}
              onPressEnter={handleConfirmUpload}
            />
            <div className="bg-blue-50/70 border border-blue-100 p-2.5 rounded-lg text-[11px] text-blue-700 leading-relaxed">
              ℹ️ Jika diisi: <strong>namafile_timestamp.pdf</strong>.<br />
              Jika dikosongkan: <strong>{poNumber || 'PO'}_{documentType || 'document'}_timestamp.pdf</strong>.
            </div>
          </div>
        </ConfigProvider>
      </Modal>
    );
  };

  const extractBaseName = (url) => {
    if (!url) return '';
    const clean = url.split('?')[0].split('/').pop();
    let decoded = clean;
    try {
      decoded = decodeURIComponent(clean);
    } catch {}
    // Remove .pdf extension
    let nameWithoutExt = decoded.replace(/\.pdf$/i, '');
    // If it has timestamp suffix (e.g. name_1773...), remove the trailing _timestamp
    nameWithoutExt = nameWithoutExt.replace(/_\d{10,}$/, '');
    return nameWithoutExt;
  };

  const handleOpenRename = (fileUrl) => {
    setRenamingFileUrl(fileUrl);
    setNewRenameFileName(extractBaseName(fileUrl));
    setIsRenameModalOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!renamingFileUrl) return;
    const trimmed = newRenameFileName.trim();
    if (!trimmed) {
      message.warning('Nama file tidak boleh kosong!');
      return;
    }

    try {
      setRenaming(true);
      const res = await renameDocument(poId, {
        poType,
        documentType,
        oldFileUrl: renamingFileUrl,
        newFileName: trimmed,
      });

      if (res.success && res.newFileUrl) {
        message.success('Dokumen berhasil diganti nama!');
        if (multiple) {
          setInternalFiles((prev) => {
            const updated = prev.map((url) => (url === renamingFileUrl ? res.newFileUrl : url));
            if (onChange) onChange(updated);
            return updated;
          });
        } else {
          if (onChange) onChange(res.newFileUrl);
        }
        setIsRenameModalOpen(false);
        setRenamingFileUrl(null);
        setNewRenameFileName('');
      }
    } catch (err) {
      message.error('Gagal mengganti nama file: ' + (err.response?.data?.error || err.message));
    } finally {
      setRenaming(false);
    }
  };

  const renderRenameModal = () => {
    return (
      <Modal
        title={
          <div className="flex items-center gap-2 text-amber-600">
            <EditOutlined />
            <span>Ubah Nama Dokumen</span>
          </div>
        }
        open={isRenameModalOpen}
        onOk={handleConfirmRename}
        onCancel={() => {
          setIsRenameModalOpen(false);
          setRenamingFileUrl(null);
          setNewRenameFileName('');
        }}
        confirmLoading={renaming}
        okText="Simpan Perubahan"
        cancelText="Batal"
        centered
        width={450}
        destroyOnClose
      >
        <ConfigProvider componentDisabled={false}>
          <div className="py-2 space-y-3">
            <p className="text-xs text-gray-500 m-0">
              Masukkan nama baru untuk dokumen ini:
            </p>
            <Input
              placeholder="Contoh: Timesheet_Teknisi_Budi"
              value={newRenameFileName}
              onChange={(e) => setNewRenameFileName(e.target.value)}
              addonAfter=".pdf"
              autoFocus
              disabled={false}
              onPressEnter={handleConfirmRename}
            />
            <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-lg text-[11px] text-amber-800 leading-relaxed">
              ℹ️ Nama baru akan disimpan dengan format: <strong>namafile_timestamp.pdf</strong>.
            </div>
          </div>
        </ConfigProvider>
      </Modal>
    );
  };

  // ── Multiple mode ──────────────────────────────────────
  if (multiple) {
    const files = internalFiles;

    return (
      <div>
        <Space direction="vertical" className="w-full" size={4}>
          {files.map((fileUrl, index) => {
            const fullName = getFileName(fileUrl);
            const displayName = truncateFileName(fullName, 20);

            return (
              <div key={index} className="flex items-center gap-2">
                <Tag
                  color="orange"
                  className="max-w-[200px] overflow-hidden text-ellipsis"
                  title={fullName}
                >
                  {displayName}
                </Tag>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(getFileUrl(fileUrl), '_blank')}
                  title="Unduh Dokumen"
                />
                {!disabled && (
                  <Button
                    size="small"
                    icon={<EditOutlined style={{ color: '#d97706' }} />}
                    onClick={() => handleOpenRename(fileUrl)}
                    title="Ubah Nama Dokumen"
                  />
                )}
                {!disabled && (
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteFile(fileUrl)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            );
          })}
          <Upload
            beforeUpload={handleBeforeUpload}
            customRequest={customRequest}
            showUploadList={false}
            disabled={disabled || uploading}
          >
            <Button
              icon={<PlusOutlined />}
              size="small"
              loading={uploading}
              disabled={disabled || uploading}
            >
              {label || 'Add File'}
            </Button>
          </Upload>
        </Space>

        {renderNameModal()}
        {renderRenameModal()}
      </div>
    );
  }

  // ── Single mode (original behavior, backward compatible) ──
  const fullFileName = getFileName(value);
  const displayFileName = truncateFileName(fullFileName, 15);

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-2">
          <Tag
            color="green"
            icon={<CheckCircleOutlined />}
            title={fullFileName}
            className="max-w-[180px]"
          >
            {displayFileName}
          </Tag>

          <Button
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              window.open(getFileUrl(value), '_blank');
            }}
            disabled={false}
            title="Unduh Dokumen"
          />

          {!disabled && (
            <Button
              size="small"
              icon={<EditOutlined style={{ color: '#d97706' }} />}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRename(value);
              }}
              title="Ubah Nama Dokumen"
            />
          )}

          {!disabled && (
            <Upload
              beforeUpload={handleBeforeUpload}
              customRequest={customRequest}
              showUploadList={false}
              disabled={disabled || uploading}
            >
              <Button size="small" type="link" loading={uploading}>
                Change File
              </Button>
            </Upload>
          )}
        </div>
      ) : (
        <Upload
          beforeUpload={handleBeforeUpload}
          customRequest={customRequest}
          showUploadList={false}
          maxCount={1}
          disabled={disabled || uploading}
        >
          <Button
            icon={<UploadOutlined />}
            size="small"
            loading={uploading}
            disabled={disabled || uploading}
          >
            Choose File
          </Button>
        </Upload>
      )}

      {renderNameModal()}
      {renderRenameModal()}
    </div>
  );
};

export default DocumentUpload;