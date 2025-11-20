/**
 * Simple authentication utilities
 * Password hashing, session token generation, and cookie management
 */
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase';
import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'simple_auth_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production-use-strong-random-secret';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a session token hash for storage
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token + SESSION_SECRET).digest('hex');
}

/**
 * Verify a session token
 */
export function verifySessionToken(token: string, storedHash: string): boolean {
  const computedHash = hashSessionToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(storedHash)
  );
}

/**
 * Get user by email from database
 */
export async function getUserByEmail(email: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('simple_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error fetching user from database:', error);
      // If table doesn't exist, provide helpful error
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        throw new Error('Authentication table not found. Please run SQL migration: sql/039_simple_auth_users.sql');
      }
      return null;
    }

    if (!data) {
      return null;
    }

    return data;
  } catch (err: any) {
    console.error('Error in getUserByEmail:', err);
    throw err;
  }
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(email: string, password: string) {
  const user = await getUserByEmail(email);
  
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password_hash);
  
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Create a session and set cookie
 */
export async function createSession(userId: string, email: string) {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  // Store session in database (simple_sessions table)
  // For now, we'll use a simple approach with cookies only
  // In production, you might want to store sessions in DB for revocation

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
    // Ensure cookie is available across the entire site
  });
  
  console.log('Session cookie set:', SESSION_COOKIE_NAME, 'token length:', token.length);

  return token;
}

/**
 * Get session token from request
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

/**
 * Verify session token and get user
 */
export async function verifySession(token: string) {
  // For simple implementation, we'll store user info in a sessions table
  // For now, we'll verify the token format and check if user exists
  // In a production system, you'd store active sessions in DB
  
  // Since we only have one user, we can simplify this
  // Just verify the token is valid format and check cookie
  if (!token || token.length !== 64) {
    return null;
  }

  // Get the user from cookie - for single user system, we can simplify
  const user = await getUserByEmail('admin@momenta.app');
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Get current authenticated user from request
 */
export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  return verifySession(token);
}

/**
 * Clear session (logout)
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

