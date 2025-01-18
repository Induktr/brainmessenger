import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthError, AuthApiError } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateEmail } from "@/utils/validation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoCircledIcon, EyeOpenIcon, EyeNoneIcon } from "@radix-ui/react-icons";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});
  const [loginAttempts, setLoginAttempts] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/chat");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };
    delete newErrors[field];

    switch (field) {
      case 'email':
        if (!validateEmail(value)) {
          newErrors.email = ['Please enter a valid email address'];
        }
        break;
      case 'password':
        if (!value) {
          newErrors.password = ['Password is required'];
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    validateField('email', email);
    validateField('password', password);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setLoginAttempts(prev => prev + 1);
        
        if (error.message.includes('Invalid login credentials')) {
          setErrors({
            auth: ['Invalid email or password. Please check your credentials and try again.']
          });
        } else if (error.message.includes('Email not confirmed')) {
          setErrors({
            auth: ['Please verify your email address before logging in.', 
                  'Check your inbox for the verification email.']
          });
        } else {
          setErrors({
            auth: [error.message]
          });
        }

        // Show additional help after multiple failed attempts
        if (loginAttempts >= 2) {
          setErrors(prev => ({
            ...prev,
            help: ['Having trouble logging in?',
                   'Try resetting your password or contact support for assistance.']
          }));
        }
        
        return;
      }

      // Login successful
      toast({
        title: "Welcome back!",
        description: "Successfully logged in to your account.",
      });
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      setErrors({
        auth: ['An unexpected error occurred. Please try again later.']
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back!"
      subtitle="Enter your credentials to access your account"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.auth && (
          <Alert variant="destructive">
            {errors.auth.map((error, index) => (
              <AlertDescription key={index}>{error}</AlertDescription>
            ))}
          </Alert>
        )}

        {errors.help && (
          <Alert className="bg-blue-50 border-blue-200">
            {errors.help.map((message, index) => (
              <AlertDescription key={index} className="text-blue-800">
                {message}
              </AlertDescription>
            ))}
          </Alert>
        )}

        <div className="space-y-2">
          <div className="relative">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                validateField('email', e.target.value);
              }}
              className={`w-full ${errors.email ? 'border-red-500' : ''}`}
              required
            />
            {errors.email && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoCircledIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{errors.email[0]}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                validateField('password', e.target.value);
              }}
              className={`w-full pr-10 ${errors.password ? 'border-red-500' : ''}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeNoneIcon className="h-4 w-4" />
              ) : (
                <EyeOpenIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="text-primary hover:text-primary-hover transition-colors"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-primary hover:text-primary-hover transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-white"
          disabled={isLoading || Object.keys(errors).length > 0}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>

        <p className="text-center text-sm text-gray-500">
          Need help? <button
            type="button"
            onClick={() => navigate("/help")}
            className="text-primary hover:text-primary-hover transition-colors"
          >
            Contact support
          </button>
        </p>
      </form>
    </AuthLayout>
  );
};