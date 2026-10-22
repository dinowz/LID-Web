import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  AlertCircle,
  CheckCircle,
  User,
  Mail,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { register } from '../services/auth.service';
import logo from '../assets/logo.png';
import { Form, Input, Button, Select } from 'antd';

const ROLES = ['ADMIN', 'PROCUREMENT', 'LOGISTIC', 'FINANCE', 'PROJECT', 'TFS', 'SPARE_PART', 'SERVICE', 'MANAGEMENT'];

const Register = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await register(values);
      setSuccess(response.message || 'Registration successful. Your account is pending approval.');

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred during registration');
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
          <div className="inline-flex items-center justify-center  px-6 py-4 mb-4">
            <img
              src={logo}
              alt="Loesche Indonesia Logo"
              className="h-16 w-auto"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Register to access LIND Digitalization System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/70 px-6 py-7 sm:px-8">
          {success ? (
            <div className="text-center py-5">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-primary-600">
                <CheckCircle size={42} />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Registration Successful
              </h3>

              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {success}
              </p>

              <Link
                to="/login"
                className="inline-flex items-center justify-center text-sm font-semibold !text-primary-600 hover:!text-primary-700 transition-colors"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <>
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
                  label="Full Name"
                  name="name"
                  rules={[{ required: true, message: 'Please input your full name!' }]}
                  className="mb-4"
                >
                  <Input
                    size="large"
                    prefix={<User size={18} className="text-gray-400 mr-1" />}
                    placeholder="Enter your full name"
                    className="
                      h-11
                      rounded-xl
                      !bg-gray-50
                      border-gray-200
                      hover:border-primary-400
                      focus:border-primary-500
                      focus:shadow-none
                      [&_.ant-input]:!bg-transparent
                      [&_.ant-input]:!text-gray-800
                      [&_.ant-input::placeholder]:!text-gray-400
                    "
                  />
                </Form.Item>

                <Form.Item
                  label="Email Address"
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
                      hover:border-primary-400
                      focus:border-primary-500
                      focus:shadow-none
                      [&_.ant-input]:!bg-transparent
                      [&_.ant-input]:!text-gray-800
                      [&_.ant-input::placeholder]:!text-gray-400
                    "
                  />
                </Form.Item>

                <Form.Item
                  label="Password"
                  name="password"
                  rules={[
                    { required: true, message: 'Please input your password!' },
                    { min: 6, message: 'Password must be at least 6 characters!' },
                  ]}
                  className="mb-4"
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

                <Form.Item
                  label="Requested Role"
                  name="role"
                  rules={[{ required: true, message: 'Please select a role!' }]}
                  className="mb-5"
                >
                  <Select
                    size="large"
                    suffixIcon={<ShieldCheck size={18} className="text-gray-400" />}
                    placeholder="Select requested role"
                    className="
                      w-full
                      h-11

                      [&_.ant-select-selector]:!h-11
                      [&_.ant-select-selector]:!rounded-xl
                      [&_.ant-select-selector]:!bg-gray-50
                      [&_.ant-select-selector]:!border-gray-200
                      [&_.ant-select-selector]:!shadow-none
                      hover:[&_.ant-select-selector]:!border-primary-400

                      [&_.ant-select-selection-item]:!flex
                      [&_.ant-select-selection-item]:!items-center
                      [&_.ant-select-selection-item]:!text-gray-800

                      [&_.ant-select-selection-placeholder]:!text-gray-400
                    "
                    popupClassName="rounded-xl"
                  >
                    {ROLES.map((role) => (
                      <Select.Option key={role} value={role}>
                        {role}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item className="mb-4">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    icon={!loading && <UserPlus size={18} />}
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
                    Sign Up
                  </Button>
                </Form.Item>

                <div className="text-center pt-1">
                  <p className="text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="!text-primary-600 hover:!text-primary-700 font-semibold transition-colors"
                    >
                      Sign in here
                    </Link>
                  </p>
                </div>
              </Form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Internal Business Monitoring
        </p>
      </div>
    </div>
  );
};

export default Register;