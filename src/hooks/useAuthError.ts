import { useState } from 'react';

interface AuthErrors {
  email?: string[];
  password?: string[];
  form?: string[];
}

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

  const setFieldError = (field: keyof AuthErrors, errors: string[]) => {
    setErrors(prev => ({
      ...prev,
      [field]: errors
    }));
  };

  const handleAuthError = (error: unknown) => {
    if (error instanceof Error) {
      setFieldError('form', [error.message]);
    } else {
      setFieldError('form', ['An unknown error occurred']);
    }
  };

  return {
    errors,
    clearErrors,
    setFieldError,
    handleAuthError
  };
};
