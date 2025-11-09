import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSessionUser } from '@/lib/auth-utils';
import { envServer } from '@/lib/env-server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Initialize Resend client lazily to provide better error messages
function getResendClient() {
  if (!envServer.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  return new Resend(envServer.RESEND_API_KEY);
}

interface ContactFormData {
  email: string;
  name: string;
  company?: string;
  subject: string;
  message: string;
  creatorId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();
    const { email, name, company, subject, message, creatorId } = body;

    // Validate required fields
    if (!email || !name || !subject || !message || !creatorId) {
      return NextResponse.json(
        {
          error: 'Missing required fields: email, name, subject, message, and creatorId are required',
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

    // Get authenticated user (if logged in)
    const loggedInUser = await getSessionUser(request);
    console.log('Contact form submission - User:', loggedInUser ? {
      id: loggedInUser.id,
      email: loggedInUser.email,
      display_name: loggedInUser.display_name,
      role: loggedInUser.role
    } : 'Anonymous user');

    // Fetch creator information from database
    const { data: creatorData, error: creatorError } = await supabaseAdmin
      .from('creators_hot')
      .select('creator_id, username, display_name')
      .eq('creator_id', creatorId)
      .single();

    if (creatorError || !creatorData) {
      console.error('Error fetching creator:', creatorError);
      // Continue anyway, we'll use creatorId as fallback
    }

    const creatorName = creatorData?.display_name || creatorData?.username || 'Unknown Creator';
    const creatorUsername = creatorData?.username || '';

    // Build email subject
    const emailSubject = company
      ? `CONTACT ${name} ${company}`
      : `CONTACT ${name}`;

    // Build email body
    const appUrl = envServer.NEXT_PUBLIC_APP_URL;
    const creatorProfileLink = `${appUrl}/creator/${creatorId}`;

    let emailBody = `Name: ${name}\n`;
    emailBody += `Email: ${email}\n`;
    emailBody += `Company: ${company || 'Not provided'}\n`;
    emailBody += `Subject: ${subject}\n\n`;
    emailBody += `Message:\n${message}\n\n`;
    emailBody += `---\n`;
    emailBody += `Creator Information:\n`;
    emailBody += `- Name: ${creatorName}\n`;
    emailBody += `- Username: @${creatorUsername}\n`;
    emailBody += `- Profile: ${creatorProfileLink}\n\n`;
    emailBody += `Contact Request From:\n`;

    if (loggedInUser) {
      const userDisplayName = loggedInUser.display_name || loggedInUser.email || 'Unknown User';
      const userProfileLink = `${appUrl}/profile/${loggedInUser.id}`;
      emailBody += `- ${userDisplayName} (ID: ${loggedInUser.id}, Role: ${loggedInUser.role})\n`;
      emailBody += `- User Profile: ${userProfileLink}\n`;
    } else {
      emailBody += `- Anonymous user\n`;
    }

    // Send email using Resend
    // The user's email address (from the form) is NOT sent an email
    // It's only included in the body of the email sent to partnerships@fanedit.com
    // We send ONE email to partnerships@fanedit.com containing all the form data
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

      // Save contact status if user is logged in
      if (loggedInUser) {
        try {
          const { error: contactError } = await supabaseAdmin
            .from('creator_contacts')
            .insert({
              user_id: loggedInUser.id,
              creator_id: creatorId,
            })
            .select()
            .single();

          if (contactError && contactError.code !== '23505') {
            // 23505 = unique constraint violation (already contacted) - ignore
            console.error('Error saving contact status:', contactError);
            // Don't fail the request, email was sent successfully
          }
        } catch (saveError) {
          console.error('Error saving contact status:', saveError);
          // Don't fail the request, email was sent successfully
        }
      }

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
    console.error('Error in contact form API:', error);
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

