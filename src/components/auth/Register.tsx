import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthError, AuthApiError } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateEmail, validatePassword, validateNickname } from "@/utils/validation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Progress } from "@/components/ui/progress";

export const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 25;
    return strength;
  };

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
        const { errors: passwordErrors } = validatePassword(value);
        if (passwordErrors.length > 0) {
          newErrors.password = passwordErrors;
        }
        setPasswordStrength(calculatePasswordStrength(value));
        break;
      case 'nickname':
        const { errors: nicknameErrors } = validateNickname(value);
        if (nicknameErrors.length > 0) {
          newErrors.nickname = nicknameErrors;
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
    validateField('nickname', nickname);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            username: nickname.trim(),
          },
          emailRedirectTo: window.location.origin + '/login',
        },
      });

      if (error) {
        if (error instanceof AuthApiError) {
          if (error.message.includes('already registered')) {
            setErrors({ email: ['This email is already registered. Please try logging in instead.'] });
            return;
          }
          throw error;
        }
      }

      if (!data.user || data.user.identities?.length === 0) {
        setErrors({ email: ['This email is already registered. Please try logging in instead.'] });
        return;
      }

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
      navigate("/login");
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 25) return "bg-red-500";
    if (passwordStrength <= 50) return "bg-orange-500";
    if (passwordStrength <= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Join our community and start chatting"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Input
              type="text"
              placeholder="Nickname"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                validateField('nickname', e.target.value);
              }}
              className={`w-full pr-10 ${errors.nickname ? 'border-red-500' : ''}`}
              required
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nickname must be 3-30 characters long and can only contain letters, numbers, underscores, and hyphens</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {errors.nickname && (
            <p className="text-sm text-red-500">{errors.nickname[0]}</p>
          )}
        </div>

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
          </div>
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                validateField('password', e.target.value);
              }}
              className={`w-full pr-10 ${errors.password ? 'border-red-500' : ''}`}
              required
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Password must be at least 8 characters long and contain:</p>
                  <ul className="list-disc list-inside">
                    <li>One uppercase letter</li>
                    <li>One number</li>
                    <li>One special character</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {password && (
            <div className="space-y-1">
              <Progress value={passwordStrength} className={getPasswordStrengthColor()} />
              <p className="text-sm text-gray-500">
                Password strength: {passwordStrength <= 25 ? 'Weak' : passwordStrength <= 50 ? 'Fair' : passwordStrength <= 75 ? 'Good' : 'Strong'}
              </p>
            </div>
          )}
          {errors.password && (
            <ul className="text-sm text-red-500 list-disc list-inside">
              {errors.password.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-primary hover:text-primary-hover transition-colors"
          >
            Already have an account? Sign in
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
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
};