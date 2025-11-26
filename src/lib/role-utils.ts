/**
 * Role utilities for checking user permissions
 */

import type { UserRole } from '@/app/types/data';

/**
 * Check if a user has a specific role
 */
export function hasRole(profileRole: UserRole | undefined | null, requiredRole: UserRole): boolean {
  if (!profileRole) return false;
  
  const roleHierarchy: Record<UserRole, number> = {
    standard: 0,
    creator: 1,
    brand: 2,
    admin: 3,
  };
  
  return roleHierarchy[profileRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if user is admin
 */
export function isAdmin(profileRole: UserRole | undefined | null): boolean {
  return profileRole === 'admin';
}

/**
 * Check if user is brand or admin
 */
export function isBrandOrAdmin(profileRole: UserRole | undefined | null): boolean {
  return profileRole === 'brand' || profileRole === 'admin';
}

/**
 * Check if user is creator or admin
 */
export function isCreatorOrAdmin(profileRole: UserRole | undefined | null): boolean {
  return profileRole === 'creator' || profileRole === 'admin';
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole | undefined | null): string {
  if (!role) return 'Unknown';
  
  const displayNames: Record<UserRole, string> = {
    standard: 'Standard',
    creator: 'Creator',
    brand: 'Brand',
    admin: 'Admin',
  };
  
  return displayNames[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole | undefined | null): string {
  if (!role) return 'No role assigned';
  
  const descriptions: Record<UserRole, string> = {
    standard: 'Standard account with basic features',
    creator: 'Enhanced features for content creators',
    brand: 'Tools and features for brands',
    admin: 'Full system access and administration',
  };
  
  return descriptions[role] || 'Unknown role';
}

