import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthError, AuthErrors } from '@/hooks/useAuthError';
import { AuthLayout } from './AuthLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

interface LoginState {
  email: string;
  password: string;
  attempts: number;
  lockedUntil: number | null;
  isSubmitting: boolean;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string[];
}

const FormInput: React.FC<InputProps> = ({ error, className, ...props }) => (
  <div className="space-y-1">
    <Input
      {...props}
      className={cn(
        'w-full',
        error && 'border-red-500',
        className
      )}
    />
    {error?.map((err, index) => (
      <p key={index} className="text-sm text-red-500">
        {err}
      </p>
    ))}
  </div>
);

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading, initialized } = useAuth();
  const { validateSession } = useSession();
  const { errors, handleAuthError, clearErrors, setFieldError } = useAuthError();
  const { toast } = useToast();
  
  const [state, setState] = useState<LoginState>({
    email: '',
    password: '',
    attempts: 0,
    lockedUntil: null,
    isSubmitting: false
  });

  // Single useEffect to handle auth state and session
  useEffect(() => {
    let mounted = true;

    const checkAuthState = async () => {
      try {
        // Wait for auth to initialize
        if (!initialized) return;

        // If already authenticated, redirect
        if (isAuthenticated) {
          navigate('/chat', { replace: true });
          return;
        }

        // Check for existing session
        const session = await validateSession();
        if (mounted && session?.user) {
          // Let auth provider handle the redirect
          return;
        }
      } catch (error) {
        console.error('Auth state check error:', error);
        if (mounted) {
          toast({
            title: "Session Error",
            description: "Please log in to continue.",
            variant: "destructive"
          });
        }
      }
    };

    checkAuthState();
    return () => { mounted = false; };
  }, [initialized, isAuthenticated, validateSession, navigate, toast]);

  const validateForm = (): boolean => {
    clearErrors();
    let isValid = true;

    if (!state.email.trim()) {
      setFieldError('email', ['Email is required']);
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
      setFieldError('email', ['Invalid email format']);
      isValid = false;
    }

    if (!state.password) {
      setFieldError('password', ['Password is required']);
      isValid = false;
    } else if (state.password.length < 6) {
      setFieldError('password', ['Password must be at least 6 characters']);
      isValid = false;
    }

    return isValid;
  };

  const handleLoginError = (error: any) => {
    // Handle failed login attempt
    const newAttempts = state.attempts + 1;
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_DURATION;
      setState(prev => ({ 
        ...prev, 
        attempts: 0,
        lockedUntil,
        isSubmitting: false 
      }));
      toast({
        title: "Account Locked",
        description: `Too many failed attempts. Account is locked for ${LOCKOUT_DURATION / 60000} minutes.`,
        variant: "destructive"
      });
    } else {
      setState(prev => ({ 
        ...prev, 
        attempts: newAttempts,
        isSubmitting: false 
      }));
    }
    handleAuthError(error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if account is locked
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      const remainingMinutes = Math.ceil((state.lockedUntil - Date.now()) / 60000);
      toast({
        title: "Account Locked",
        description: `Too many failed attempts. Please try again in ${remainingMinutes} minutes.`,
        variant: "destructive"
      });
      return;
    }

    // Validate form
    if (!validateForm()) return;

    try {
      setState(prev => ({ ...prev, isSubmitting: true }));
      clearErrors();

      const { error } = await login(state.email, state.password);

      if (error) {
        handleLoginError(error);
      } else {
        // Reset form state only - let auth provider handle navigation
        setState({
          email: '',
          password: '',
          attempts: 0,
          lockedUntil: null,
          isSubmitting: false
        });
      }

    } catch (error) {
      console.error('Login error:', error);
      setState(prev => ({ ...prev, isSubmitting: false }));
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setState(prev => ({ ...prev, [name]: value }));
    clearErrors();
  };

  return (
    <AuthLayout title="Login" subtitle="Enter your email and password to login">
      <div className="flex flex-col space-y-6">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <FormInput
              id="email"
              name="email"
              type="email"
              placeholder="Email"
              value={state.email}
              onChange={handleInputChange}
              error={errors.email}
              disabled={!!(state.isSubmitting || authLoading)}
              autoComplete="email"
              autoFocus
            />

            <FormInput
              id="password"
              name="password"
              type="password"
              placeholder="Password"
              value={state.password}
              onChange={handleInputChange}
              error={errors.password}
              disabled={!!(state.isSubmitting || authLoading)}
              autoComplete="current-password"
            />
          </div>

          {errors.form && (
            <div className="text-sm text-red-500">
              {errors.form.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!!(state.isSubmitting || authLoading || (state.lockedUntil && Date.now() < state.lockedUntil))}
          >
            {state.isSubmitting || authLoading ? (
              <div className="flex items-center justify-center">
                <div className="h-4 w-4 border-2 border-white rounded-full animate-spin border-t-transparent" />
                <span className="ml-2">Logging in...</span>
              </div>
            ) : (
              'Login'
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <a href="/register" className="underline hover:text-primary">
            Don't have an account? Register
          </a>
        </div>
      </div>
    </AuthLayout>
  );
};