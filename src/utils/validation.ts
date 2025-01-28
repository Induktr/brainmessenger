export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordStrength {
  score: number;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
  feedback: string[];
}

export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!email) {
    errors.push('Email is required');
  } else if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  } else if (email.length > 255) {
    errors.push('Email must be less than 255 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePassword = (password: string): ValidationResult & { strength: PasswordStrength } => {
  const errors: string[] = [];
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  if (!password) {
    errors.push('Password is required');
  }
  if (!requirements.minLength) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!requirements.hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!requirements.hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!requirements.hasNumber) {
    errors.push('Password must contain at least one number');
  }
  if (!requirements.hasSpecial) {
    errors.push('Password must contain at least one special character');
  }

  let score = 0;
  if (requirements.minLength) score += 20;
  if (requirements.hasUppercase) score += 20;
  if (requirements.hasLowercase) score += 20;
  if (requirements.hasNumber) score += 20;
  if (requirements.hasSpecial) score += 20;

  const feedback = [
    ...errors,
    password.length > 12 ? 'Strong length' : 'Consider using a longer password',
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(password)
      ? 'Excellent password strength'
      : 'Consider making your password stronger'
  ];

  return {
    isValid: errors.length === 0,
    errors,
    strength: {
      score,
      requirements,
      feedback: feedback.filter(Boolean)
    }
  };
};

export const validateNickname = (nickname: string): ValidationResult => {
  const errors: string[] = [];
  const nicknameRegex = /^[a-zA-Z0-9_-]{3,30}$/;

  if (!nickname) {
    errors.push('Nickname is required');
  } else if (!nicknameRegex.test(nickname)) {
    errors.push('Nickname must be 3-30 characters and can only contain letters, numbers, underscores, and hyphens');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
