import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSessionUser } from '@/lib/auth-utils';
import { envServer } from '@/lib/env-server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Rate limiting constants
const RATE_LIMIT_WINDOW_HOURS = 24; // 24 hour window
const RATE_LIMIT_MAX_SUBMISSIONS = 3; // Max 3 submissions per 24 hours per IP
const MIN_FORM_TIME_MS = 3000; // Minimum 3 seconds (3000ms) to fill form

// Initialize Resend client lazily to provide better error messages
function getResendClient() {
  if (!envServer.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  return new Resend(envServer.RESEND_API_KEY);
}

// Get client IP address from request
function getClientIP(request: NextRequest): string {
  // Check various headers for IP (order matters - most trusted first)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Fallback to 'unknown' if no IP can be determined
  return 'unknown';
}

// Check IP-based rate limiting
async function checkIPRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    // Get submissions from the last 24 hours for this IP
    const twentyFourHoursAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
    
    const { data: recentSubmissions, error } = await supabaseAdmin
      .from('brand_contact_submissions')
      .select('id')
      .eq('ip_address', ip)
      .gte('created_at', twentyFourHoursAgo.toISOString());

    if (error) {
      console.error('Error checking IP rate limit:', error);
      // On error, allow the request (fail open) but log the error
      return { allowed: true, remaining: RATE_LIMIT_MAX_SUBMISSIONS, resetAt: new Date() };
    }

    const submissionCount = recentSubmissions?.length || 0;
    const allowed = submissionCount < RATE_LIMIT_MAX_SUBMISSIONS;
    const remaining = Math.max(0, RATE_LIMIT_MAX_SUBMISSIONS - submissionCount);
    
    // Calculate reset time (24 hours from oldest submission, or now if no submissions)
    const resetAt = recentSubmissions && recentSubmissions.length > 0
      ? new Date(twentyFourHoursAgo.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000)
      : new Date();

    return { allowed, remaining, resetAt };
  } catch (error) {
    console.error('Error in checkIPRateLimit:', error);
    // Fail open on error
    return { allowed: true, remaining: RATE_LIMIT_MAX_SUBMISSIONS, resetAt: new Date() };
  }
}

// Record IP submission
async function recordIPSubmission(ip: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('brand_contact_submissions')
      .insert({
        ip_address: ip,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error recording IP submission:', error);
    // Don't fail the request if recording fails
  }
}

interface ContactFormData {
  email: string;
  name: string;
  company: string;
  subject: string;
  message: string;
  honeypot?: string;
  formTime?: number; // Time taken to fill form in milliseconds
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();
    const { email, name, company, subject, message, honeypot, formTime } = body;

    // 1. HONEYPOT VALIDATION - Reject if honeypot field is filled
    if (honeypot && honeypot.trim() !== '') {
      console.warn('Bot detected: Honeypot field was filled', { honeypot });
      return NextResponse.json(
        {
          error: 'Invalid submission',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // 2. TIME-BASED VALIDATION - Reject if form was submitted too quickly
    if (formTime !== undefined && formTime < MIN_FORM_TIME_MS) {
      console.warn('Bot detected: Form submitted too quickly', { formTime, minTime: MIN_FORM_TIME_MS });
      return NextResponse.json(
        {
          error: 'Please take your time filling out the form',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!email || !name || !company || !subject || !message) {
      return NextResponse.json(
        {
          error: 'Missing required fields: email, name, company, subject, and message are required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: 'Invalid email format',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // 3. IP-BASED RATE LIMITING
    const clientIP = getClientIP(request);
    const rateLimit = await checkIPRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          details: `Maximum ${RATE_LIMIT_MAX_SUBMISSIONS} submissions per ${RATE_LIMIT_WINDOW_HOURS} hours. Please try again later.`,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 }
      );
    }

    // Get authenticated user (if logged in)
    const loggedInUser = await getSessionUser(request);
    console.log('Brand contact form submission - User:', loggedInUser ? {
      id: loggedInUser.id,
      email: loggedInUser.email,
      display_name: loggedInUser.display_name,
      role: loggedInUser.role
    } : 'Anonymous user', 'IP:', clientIP);

    // Build email subject - "Contact Brand [company name]"
    const emailSubject = `Contact Brand ${company}`;

    // Build email body
    const appUrl = envServer.NEXT_PUBLIC_APP_URL;

    let emailBody = `Name: ${name}\n`;
    emailBody += `Email: ${email}\n`;
    emailBody += `Company: ${company}\n`;
    emailBody += `Subject: ${subject}\n\n`;
    emailBody += `Message:\n${message}\n\n`;
    emailBody += `---\n`;
    emailBody += `Contact Request From:\n`;

    if (loggedInUser) {
      const userDisplayName = loggedInUser.display_name || loggedInUser.email || 'Unknown User';
      const userProfileLink = `${appUrl}/profile/${loggedInUser.id}`;
      emailBody += `- ${userDisplayName} (ID: ${loggedInUser.id}, Role: ${loggedInUser.role})\n`;
      emailBody += `- User Profile: ${userProfileLink}\n`;
    } else {
      emailBody += `- Anonymous user\n`;
    }
    
    emailBody += `- IP Address: ${clientIP}\n`;
    emailBody += `- Form Time: ${formTime ? `${(formTime / 1000).toFixed(1)}s` : 'unknown'}\n`;

    // Send email using Resend
    try {
      const resend = getResendClient();
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'FanEdit <noreply@fanedit.com>',
        to: ['partnerships@fanedit.com'],
        subject: emailSubject,
        text: emailBody,
      });

      if (emailError) {
        console.error('Resend API error:', emailError);
        return NextResponse.json(
          {
            error: 'Failed to send email',
            code: 'EMAIL_ERROR',
            details: emailError.message || 'Unknown Resend error',
          },
          { status: 500 }
        );
      }

      // Record successful submission for rate limiting
      await recordIPSubmission(clientIP);

      return NextResponse.json({
        success: true,
        message: 'Contact form submitted successfully',
        emailId: emailData?.id,
      });
    } catch (resendError) {
      console.error('Resend initialization error:', resendError);
      return NextResponse.json(
        {
          error: 'Email service not configured',
          code: 'CONFIG_ERROR',
          details: resendError instanceof Error ? resendError.message : 'RESEND_API_KEY is missing',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in brand contact form API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

