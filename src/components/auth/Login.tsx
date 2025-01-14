import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthError, AuthApiError } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const getErrorMessage = (error: AuthError) => {
    if (error instanceof AuthApiError) {
      switch (error.status) {
        case 400:
          if (error.message.includes("Email not confirmed")) {
            return "Please verify your email address before signing in. Check your inbox for the verification link.";
          }
          if (error.message.includes("Invalid login credentials")) {
            return "The email or password you entered is incorrect. Please try again or use the 'Forgot password' option below.";
          }
          return "Invalid email or password. Please check your credentials and try again.";
        case 422:
          return "Please enter a valid email address.";
        case 429:
          return "Too many login attempts. Please try again later.";
        default:
          return error.message;
      }
    }
    return "An unexpected error occurred. Please try again.";
  };

  const validateForm = () => {
    if (!email || !password) {
      setErrorMessage("Please fill in all fields");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage("Please enter a valid email address");
      return false;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long");
      return false;
    }
    return true;
  };

  const clearError = () => {
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "Successfully signed in.",
      });
    } catch (error) {
      const authError = error as AuthError;
      const message = getErrorMessage(authError);
      setErrorMessage(message);
      setPassword(""); // Clear password on error for security
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
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
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
            required
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
            required
            className="w-full"
          />
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
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-white"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
};