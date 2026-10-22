import React from 'react';
import { Button, Tooltip, Space } from 'antd';
import { EyeOutlined, FormOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';

/**
 * Tombol View / Detail
 */
export const ViewActionButton = ({ onClick, tooltip = 'Lihat Detail', disabled = false }) => (
  <Tooltip title={tooltip}>
    <Button
      // type="text"
      icon={<EyeOutlined style={{ fontSize: 14, color: '#3b82f6' }} />}
      onClick={onClick}
      size="small"
      disabled={disabled}
    />
  </Tooltip>
);

/**
 * Tombol Edit (Autoswitch ke Lock Icon jika disabled/locked)
 */
export const EditActionButton = ({ onClick, isLocked = false, lockTooltip = 'Dokumen terkunci', tooltip = 'Edit' }) => (
  <Tooltip title={isLocked ? lockTooltip : tooltip}>
    <Button
      // type="text"
      icon={
        isLocked
          ? <LockOutlined style={{ fontSize: 14, color: '#d1d5db' }} />
          : <FormOutlined style={{ fontSize: 14, color: '#f97316' }} />
      }
      onClick={onClick}
      size="small"
      disabled={isLocked}
    />
  </Tooltip>
);

/**
 * Tombol Delete / Hapus
 */
export const DeleteActionButton = ({ onClick, tooltip = 'Hapus', disabled = false }) => (
  <Tooltip title={tooltip}>
    <Button
      // type="text"
      danger
      icon={<DeleteOutlined style={{ fontSize: 14, color: '#ef4444' }} />}
      onClick={onClick}
      size="small"
      disabled={disabled}
    />
  </Tooltip>
);

/**
 * Wrapper Container Tombol Aksi
 */
export const ActionButtonGroup = ({ children }) => (
  <Space size={4} className="flex items-center">
    {children}
  </Space>
);
