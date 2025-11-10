/**
 * Diagnostic API to check bulk upload setup
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    
    if (!user) {
      return NextResponse.json({
        authenticated: false,
        error: 'Not authenticated',
        suggestion: 'Please log in first'
      });
    }

    // Check environment variables
    const envCheck = {
      BRIGHT_DATA_API_KEY: !!process.env.BRIGHT_DATA_API_KEY,
      BRIGHT_DATA_CUSTOMER_ID: !!process.env.BRIGHT_DATA_CUSTOMER_ID,
      BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID: !!process.env.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID,
      BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID: !!process.env.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID,
      BRIGHT_DATA_MOCK_MODE: process.env.BRIGHT_DATA_MOCK_MODE,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
    };

    // Check user role
    const isAdmin = user.role === 'admin';

    // Check quota status
    let quotaInfo = null;
    try {
      const { data: quotaData } = await supabaseAdmin
        .from('user_daily_quotas')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', new Date().toISOString().split('T')[0])
        .single();
      
      quotaInfo = quotaData;
    } catch (err) {
      // Ignore quota check errors
    }

    // Overall status - at least one platform must be configured
    const hasAtLeastOnePlatform = envCheck.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID || 
                                   envCheck.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID;
    const canUseBulkUpload = isAdmin && 
      envCheck.BRIGHT_DATA_API_KEY && 
      envCheck.BRIGHT_DATA_CUSTOMER_ID && 
      hasAtLeastOnePlatform;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
      },
      permissions: {
        isAdmin,
        canUseBulkUpload,
        canBypassValidation: isAdmin,
      },
      environment: {
        ...envCheck,
        allRequiredVariablesSet: 
          envCheck.BRIGHT_DATA_API_KEY && 
          envCheck.BRIGHT_DATA_CUSTOMER_ID && 
          hasAtLeastOnePlatform,
        supportedPlatforms: {
          instagram: envCheck.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID,
          youtube: envCheck.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID,
        },
      },
      quota: quotaInfo ? {
        videoSubmissions: quotaInfo.video_submissions,
        date: quotaInfo.date,
        limit: isAdmin ? 'Unlimited' : 'Standard limits apply',
      } : {
        noQuotaRecordToday: true,
        limit: isAdmin ? 'Unlimited' : 'Standard limits apply',
      },
      issues: [
        ...(!isAdmin ? ['❌ User is not an admin. Run this SQL to make yourself admin:\n\n' +
          `UPDATE profiles SET role = 'admin' WHERE email = '${user.email}';`] : []),
        ...(!envCheck.BRIGHT_DATA_API_KEY ? ['❌ Missing BRIGHT_DATA_API_KEY environment variable'] : []),
        ...(!envCheck.BRIGHT_DATA_CUSTOMER_ID ? ['❌ Missing BRIGHT_DATA_CUSTOMER_ID environment variable'] : []),
        ...(!envCheck.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID && !envCheck.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID 
          ? ['❌ Missing at least one scraper ID (BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID or BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID)'] : []),
        ...(!envCheck.BRIGHT_DATA_INSTAGRAM_POST_SCRAPER_ID ? ['⚠️ Instagram scraper not configured (optional)'] : []),
        ...(!envCheck.BRIGHT_DATA_YOUTUBE_SHORTS_SCRAPER_ID ? ['⚠️ YouTube Shorts scraper not configured (optional)'] : []),
      ],
      recommendations: canUseBulkUpload ? [
        '✅ All checks passed! You can use bulk upload.'
      ] : [
        'To enable bulk upload:',
        ...(!isAdmin ? ['1. Update your role to admin in the database (see SQL above)'] : []),
        ...(!envCheck.BRIGHT_DATA_API_KEY || !envCheck.BRIGHT_DATA_CUSTOMER_ID || !hasAtLeastOnePlatform ? 
          ['2. Add missing BrightData environment variables to .env.local'] : []),
      ]
    }, { status: 200 });
  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({
      error: 'Failed to run diagnostics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

