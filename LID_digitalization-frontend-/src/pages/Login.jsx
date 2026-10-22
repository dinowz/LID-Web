import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, AlertCircle, Mail, LockKeyhole } from 'lucide-react';
import { login } from '../services/auth.service';
import logo from '../assets/logo.png';
import { notification, Form, Input, Button } from 'antd';

const Login = ({ setIsAuthenticated }) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setError(null);
    setLoading(true);

    try {
      const data = await login(values.email, values.password);
      sessionStorage.setItem('token', data.token);

      notification.success({
        message: 'Login Successful',
        description: 'Welcome back to LIND Digitalization System!',
        placement: 'topRight',
        duration: 3,
      });

      setIsAuthenticated(true);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-100 flex items-center justify-center px-4 py-10 font-sans">
      {/* Background decoration */}
      <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center px-6 py-4 mb-4">
            <img
              src={logo}
              alt="Loesche Indonesia Logo"
              className="h-16 w-auto"
            />
          </div>

          <p className="mt-2 text-sm text-gray-500">
            Sign in to LIND Digitalization System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/70 px-6 py-7 sm:px-8">
          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-3 text-red-600 text-sm mb-6">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Form
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            className="
              [&_.ant-form-item-label>label]:!text-gray-700
              [&_.ant-form-item-label>label]:!font-medium
              [&_.ant-form-item-explain-error]:!text-red-500
            "
          >
            <Form.Item
              label="Email address"
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
              className="mb-4"
            >
              <Input
                size="large"
                prefix={<Mail size={18} className="text-gray-400 mr-1" />}
                placeholder="Enter your email"
                className="
                  h-11
                  rounded-xl
                  !bg-gray-50
                  border-gray-200
                "
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
              className="mb-5"
            >
              <Input.Password
                size="large"
                prefix={<LockKeyhole size={18} className="text-gray-400 mr-1" />}
                placeholder="Enter your password"
                className="
                  h-11
                  rounded-xl
                  !bg-gray-50
                  border-gray-200
                  hover:border-primary-400
                  focus-within:border-primary-500
                  focus-within:shadow-none
                  [&_.ant-input]:!bg-transparent
                  [&_.ant-input]:!text-gray-800
                  [&_.ant-input::placeholder]:!text-gray-400
                  [&_.ant-input-password-icon]:!text-gray-400
                  hover:[&_.ant-input-password-icon]:!text-primary-500
                "
              />
            </Form.Item>

            <Form.Item className="mb-4">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                icon={!loading && <LogIn size={18} />}
                className="
                  w-full
                  !h-11
                  !rounded-xl
                  !bg-primary-600
                  hover:!bg-primary-700
                  active:!bg-primary-800
                  !border-none
                  !shadow-md
                  hover:!shadow-lg
                  flex
                  items-center
                  justify-center
                  font-medium
                "
              >
                Sign In
              </Button>
            </Form.Item>

            <div className="text-center pt-1">
              <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="!text-primary-600 hover:!text-primary-700 font-semibold transition-colors"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </Form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Internal Business Monitoring
        </p>
      </div>
    </div>
  );
};

export default Login;