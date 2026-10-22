import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { message } from 'antd';

const ProtectedRoute = ({ isAllowed, children, redirectTo = '/dashboard' }) => {
  useEffect(() => {
    if (!isAllowed) {
      message.error('Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman ini.');
    }
  }, [isAllowed]);

  if (!isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default ProtectedRoute;
