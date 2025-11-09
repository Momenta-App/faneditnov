import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      return NextResponse.json({
        status: 'error',
        timestamp: new Date().toISOString(),
        storage_ok: false,
        storage_error: 'Supabase admin client not available',
        db_ok: false,
        db_error: 'Supabase admin client not available',
        bucket: STORAGE_BUCKET
      }, { status: 500 });
    }

    // Test Supabase storage
    let storage_ok = false;
    let storage_error = null;

    try {
      const { data, error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .list('', { limit: 1 });

      if (error) {
        storage_error = error.message;
      } else {
        storage_ok = true;
      }
    } catch (error) {
      storage_error = error instanceof Error ? error.message : 'Unknown storage error';
    }

    // Test database connection
    let db_ok = false;
    let db_error = null;

    try {
      const { data, error } = await supabaseAdmin
        .from('bd_ingestions')
        .select('id')
        .limit(1);

      if (error) {
        db_error = error.message;
      } else {
        db_ok = true;
      }
    } catch (error) {
      db_error = error instanceof Error ? error.message : 'Unknown database error';
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage_ok,
      storage_error,
      db_ok,
      db_error,
      bucket: STORAGE_BUCKET
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
