import dayjs from 'dayjs';

/**
 * Global Status Registry
 * Menjadi Single Source of Truth untuk seluruh label, warna, dan status badge di aplikasi.
 */
export const GLOBAL_STATUS_CONFIG = {
  // ── INQUIRY STATUSES ──
  OPEN: { label: 'OPEN', color: 'blue', antStatus: 'Processing' },
  CONVERTED: { label: 'CONVERTED', color: 'green', antStatus: 'Success' },

  // ── QUOTATION STATUSES ──
  DRAFT: { label: 'DRAFT', color: 'gold', antStatus: 'Warning' },
  SENT: { label: 'SENT', color: 'blue', antStatus: 'Processing' },
  REALIZED: { label: 'REALIZED', color: 'cyan', antStatus: 'Success' },
  EXECUTED: { label: 'EXECUTED', color: 'purple', antStatus: 'Success' },
  CLOSE_LOSS: { label: 'CLOSE LOSS', color: 'volcano', antStatus: 'Error' },

  // ── PO STATUSES ──
  REVIEW: { label: 'REVIEW', color: 'warning', antStatus: 'Warning' },
  PROCESSING: { label: 'PROCESSING', color: 'processing', antStatus: 'Processing' },
  WAITING_OC: { label: 'WAITING OC', color: 'processing', antStatus: 'Processing' },
  READY: { label: 'READY', color: 'processing', antStatus: 'Processing' },

  // ── DELIVERY & GENERAL STATUSES ──
  REVIEW_LOGISTIC: { label: 'REVIEW LOGISTIC', color: 'default', antStatus: 'Default' },
  PACKED: { label: 'PACKED', color: 'cyan', antStatus: 'Processing' },
  SHIPPED: { label: 'SHIPPED', color: 'blue', antStatus: 'Processing' },
  IN_TRANSIT: { label: 'IN TRANSIT', color: 'geekblue', antStatus: 'Processing' },
  DELIVERED: { label: 'DELIVERED', color: 'green', antStatus: 'Success' },
  DELAYED: { label: 'DELAYED', color: 'red', antStatus: 'Error' },

  // ── COMMON / SYSTEM STATUSES ──
  IN_PROGRESS: { label: 'IN PROGRESS', color: 'blue', antStatus: 'Processing' },
  COMPLETED: { label: 'COMPLETED', color: 'success', antStatus: 'Success' },
  CLOSED: { label: 'CLOSED', color: 'green', antStatus: 'Success' },
  PENDING: { label: 'PENDING', color: 'warning', antStatus: 'Warning' },
  CANCELLED: { label: 'CANCELLED', color: 'error', antStatus: 'Error' },
};

/**
 * Mengembalikan warna tag berdasarkan status code.
 */
export const getStatusColor = (code) => {
  if (!code) return 'default';
  return GLOBAL_STATUS_CONFIG[code]?.color || 'default';
};

/**
 * Helper untuk mendapatkan props Antd Tag ({ color, label }) dengan warna dan label terstandarisasi.
 */
export const getStatusTagProps = (code, customLabel) => {
  if (!code) return { color: 'default', label: '-' };
  const cfg = GLOBAL_STATUS_CONFIG[code] || { color: 'default', label: code };
  return {
    color: cfg.color,
    label: customLabel || cfg.label
  };
};

/**
 * Auto-generate valueEnum untuk Ant Design ProTable filter.
 * @param {Array<string>} statusKeys - Array key status yang ingin ditampilkan pada filter
 */
export const getValueEnum = (statusKeys) => {
  if (!Array.isArray(statusKeys)) return {};
  return statusKeys.reduce((acc, key) => {
    const cfg = GLOBAL_STATUS_CONFIG[key] || { label: key, antStatus: 'Default' };
    acc[key] = { text: cfg.label, status: cfg.antStatus };
    return acc;
  }, {});
};

/**
 * Menghitung informasi idle time (DRAFT / OPEN).
 */
export const getIdleInfo = (record) => {
  if (!record) return null;
  if (record.status !== 'DRAFT' && record.status !== 'OPEN' && record.statusCode !== 'OPEN') return null;

  const ref = record.lastActivityAt || record.createdAt;
  if (!ref) return null;

  const days = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));

  if (days >= 3) return { days, color: '#ef4444', bg: '#fef2f2', label: `${days}d idle` };
  if (days >= 1) return { days, color: '#f59e0b', bg: '#fffbeb', label: `${days}d idle` };

  return null;
};
