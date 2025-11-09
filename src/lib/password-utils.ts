/**
 * Password validation and strength utilities
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number; // 0-100
}

/**
 * Calculate password strength based on various criteria
 */
export function calculatePasswordStrength(password: string): { 
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
} {
  let score = 0;
  
  // Length scoring (0-40 points)
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Character variety scoring (0-60 points)
  if (/[a-z]/.test(password)) score += 10; // lowercase
  if (/[A-Z]/.test(password)) score += 10; // uppercase
  if (/[0-9]/.test(password)) score += 10; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 10; // special chars
  if (password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
    score += 10; // bonus for having all types
  }
  if (password.length >= 12 && /[^a-zA-Z0-9]/.test(password)) {
    score += 10; // bonus for special chars in longer passwords
  }
  
  // Determine strength level
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (score < 40) {
    strength = 'weak';
  } else if (score < 60) {
    strength = 'medium';
  } else if (score < 80) {
    strength = 'strong';
  } else {
    strength = 'very-strong';
  }
  
  return { strength, score: Math.min(100, score) };
}

/**
 * Validate password against requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  // Complexity checks
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  const { strength, score } = calculatePasswordStrength(password);
  
  return {
    valid: errors.length === 0,
    errors,
    strength,
    score,
  };
}

/**
 * Get password requirements text
 */
export function getPasswordRequirements(): string[] {
  return [
    'At least 8 characters',
    'At least one uppercase letter',
    'At least one lowercase letter',
    'At least one number',
  ];
}

