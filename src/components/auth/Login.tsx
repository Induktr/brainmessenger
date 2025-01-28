import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateEmail } from "@/utils/validation";
import { useAuthError } from "@/hooks/useAuthError";
import { EyeOpenIcon, EyeNoneIcon } from "@radix-ui/react-icons";

// Define the type for errors
interface AuthErrors {
  email?: string[];
  password?: string[];
  form?: string[];
} 

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    errors = { email: [], password: [], form: [] }, 
    handleAuthError = (error: unknown) => {
      // Default implementation if not provided by hook
      console.error('Authentication error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFieldError('form', [errorMessage]);
    }, 
    setFieldError 
  } = useAuthError() || {};

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
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
        const emailValidation = validateEmail(value);
        if (!emailValidation.isValid) {
          newErrors.email = emailValidation.errors;
        }
        break;
      case 'password':
        if (!value) {
          newErrors.password = ['Password is required'];
        }
        break;
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = { ...errors };

    // Validate inputs
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.errors;
    }

    if (!password) {
      newErrors.password = ['Password is required'];
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (!data.session) {
        throw new Error('Failed to create session');
      }

      toast({
        title: "Login successful!",
        description: "Welcome back!",
        duration: 3000
      });

      navigate('/chat');

    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  const newErrors = validateField('email', e.target.value);
                  setFieldError('email', newErrors.email || []);
                }}
                className="bg-neutral-background dark:bg-dark-background"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  const newErrors = validateField('password', e.target.value);
                  setFieldError('password', newErrors.password || []);
                }}
                className="bg-neutral-background dark:bg-dark-background"
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
            {errors.form && (
              <Alert variant="destructive">
                {errors.form.map((error, index) => (
                  <AlertDescription key={index}>{error}</AlertDescription>
                ))}
              </Alert>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || Object.keys(errors).some(key => (errors[key as keyof AuthErrors] ?? []).length > 0)}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4">
        <div className="text-sm text-neutral-textSecondary dark:text-dark-textSecondary">
          Don't have an account?{" "}
          <Link to="/register" className="text-accent-action hover:underline">
            Sign up
          </Link>
        </div>
        <div className="text-sm text-neutral-textSecondary dark:text-dark-textSecondary">
          Forgot password?{" "}
          <Link to="/forgot-password" className="text-accent-action hover:underline">
            Reset password
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
};