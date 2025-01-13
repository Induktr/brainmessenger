import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthError } from "@supabase/supabase-js";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast({
        title: "Error",
        description: authError.message,
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
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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