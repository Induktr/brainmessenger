export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateNickname = (nickname: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (nickname.length < 3) {
    errors.push('Nickname must be at least 3 characters long');
  }
  
  if (nickname.length > 30) {
    errors.push('Nickname must not exceed 30 characters');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(nickname)) {
    errors.push('Nickname can only contain letters, numbers, underscores, and hyphens');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};
