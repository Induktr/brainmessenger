import { useState } from 'react';
import { AuthError, AuthApiError, AuthTokenResponse } from '@supabase/supabase-js';

interface AuthErrors {
  email?: string[];
  password?: string[];
  form?: string[];
}

type ErrorCode = 
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'invalid_grant'
  | 'rate_limit_exceeded'
  | 'invalid_email'
  | 'invalid_password'
  | 'network_error'
  | 'server_error'
  | 'unknown_error';

const getErrorCode = (error: unknown): ErrorCode => {
  if (error instanceof AuthApiError) {
    if (error.message.includes('Invalid login credentials')) return 'invalid_credentials';
    if (error.message.includes('Email not confirmed')) return 'email_not_confirmed';
    if (error.message.includes('Invalid grant')) return 'invalid_grant';
    if (error.status === 429) return 'rate_limit_exceeded';
    if (error.message.includes('Invalid email')) return 'invalid_email';
    if (error.message.includes('Password')) return 'invalid_password';
    return 'server_error';
  }
  if (error instanceof Error) {
    if (error.message.includes('network')) return 'network_error';
    if (error.message.includes('Failed to fetch')) return 'network_error';
  }
  return 'unknown_error';
};

const getErrorMessage = (code: ErrorCode): string => {
  switch (code) {
    case 'invalid_credentials':
      return 'The email or password you entered is incorrect';
    case 'email_not_confirmed':
      return 'Please verify your email address before logging in';
    case 'invalid_grant':
      return 'Your session has expired. Please log in again';
    case 'rate_limit_exceeded':
      return 'Too many attempts. Please try again in a few minutes';
    case 'invalid_email':
      return 'Please enter a valid email address';
    case 'invalid_password':
      return 'Password must be at least 6 characters';
    case 'network_error':
      return 'Network error. Please check your internet connection';
    case 'server_error':
      return 'Server error. Please try again later';
    default:
      return 'An unexpected error occurred. Please try again';
  }
};

export const useAuthError = () => {
  const [errors, setErrors] = useState<AuthErrors>({
    email: [],
    password: [],
    form: []
  });

  const clearErrors = () => {
    setErrors({
      email: [],
      password: [],
      form: []
    });
  };

  const setFieldError = (field: keyof AuthErrors, messages: string[]) => {
    setErrors(prev => ({
      ...prev,
      [field]: messages
    }));
  };

  const handleAuthError = (error: unknown) => {
    console.error('Auth error:', error);

    const errorCode = getErrorCode(error);
    const errorMessage = getErrorMessage(errorCode);

    if (error instanceof AuthApiError) {
      switch (errorCode) {
        case 'invalid_credentials':
        case 'invalid_grant':
          setFieldError('form', [errorMessage]);
          break;
        case 'email_not_confirmed':
          setFieldError('email', [errorMessage]);
          break;
        case 'invalid_email':
          setFieldError('email', [errorMessage]);
          break;
        case 'invalid_password':
          setFieldError('password', [errorMessage]);
          break;
        case 'rate_limit_exceeded':
          setFieldError('form', [errorMessage]);
          break;
        default:
          setFieldError('form', [errorMessage]);
      }
    } else if (error instanceof AuthError) {
      // Handle other auth errors
      setFieldError('form', [error.message]);
    } else if (error instanceof Error) {
      // Handle general errors
      if (errorCode === 'network_error') {
        setFieldError('form', [errorMessage]);
      } else {
        setFieldError('form', [error.message]);
      }
    } else {
      // Handle unknown errors
      setFieldError('form', ['An unexpected error occurred']);
    }
  };

  return {
    errors,
    setFieldError,
    clearErrors,
    handleAuthError
  };
};

export type { AuthErrors };
