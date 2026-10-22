import React from 'react';
import { Modal, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * UnsavedChangesModal
 *
 * A reusable confirmation modal that appears when the user
 * tries to navigate away from a page with unsaved form changes.
 *
 * Props:
 * @param {object} blocker - The blocker object from useUnsavedChangesWarning hook
 */
const UnsavedChangesModal = ({ blocker }) => {
  const isBlocked = blocker?.state === 'blocked';

  const handleStay = () => {
    blocker?.reset?.();
  };

  const handleLeave = () => {
    blocker?.proceed?.();
  };

  return (
    <Modal
      open={isBlocked}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
          Unsaved Changes
        </span>
      }
      okText="Leave Without Saving"
      cancelText="Stay on Page"
      okButtonProps={{ danger: true }}
      onOk={handleLeave}
      onCancel={handleStay}
      closable={false}
      maskClosable={false}
      centered
    >
      <Text>
        You have unsaved changes. If you leave this page, all data you have entered will be lost.
      </Text>
    </Modal>
  );
};

export default UnsavedChangesModal;
