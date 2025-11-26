/**
 * Admin API routes for individual contest management
 * GET: Get contest with stats
 * PUT: Update contest (admin only)
 * DELETE: Delete contest (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests/[id]
 * Get contest with detailed stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    // Get contest with categories and nested prizes
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('contests')
      .select(`
        *,
        contest_categories (
          id,
          name,
          description,
          rules,
          display_order,
          is_general,
          ranking_method,
          contest_prizes (
            id,
            name,
            description,
            payout_amount,
            rank_order
          )
        )
      `)
      .eq('id', id)
      .single();

    if (contestError) {
      if (contestError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      throw contestError;
    }

    // Get detailed stats
    const { count: totalSubmissions } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', id);

    const { count: verifiedSubmissions } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', id)
      .eq('verification_status', 'verified');

    const { count: pendingReview } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', id)
      .in('content_review_status', ['pending']);

    const { count: approvedSubmissions } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', id)
      .eq('content_review_status', 'approved')
      .eq('processing_status', 'approved');

    // Calculate total prize pool
    const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
      p_contest_id: id,
    });

    return NextResponse.json({
      data: {
        ...contest,
        total_prize_pool: totalPool || 0,
        stats: {
          total_submissions: totalSubmissions || 0,
          verified_submissions: verifiedSubmissions || 0,
          pending_review: pendingReview || 0,
          approved_submissions: approvedSubmissions || 0,
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching contest:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contest' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/contests/[id]
 * Update contest
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const body = await request.json();
    const {
      title,
      description,
      movie_identifier,
      start_date,
      end_date,
      status,
      required_hashtags,
      required_description_template,
      categories,
      allow_multiple_submissions,
      force_single_category,
      require_social_verification,
      require_mp4_upload,
      public_submissions_visibility,
    } = body;

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (movie_identifier !== undefined) updateData.movie_identifier = movie_identifier;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (status !== undefined) updateData.status = status;
    if (required_hashtags !== undefined) updateData.required_hashtags = required_hashtags;
    if (required_description_template !== undefined) updateData.required_description_template = required_description_template;
    if (allow_multiple_submissions !== undefined) updateData.allow_multiple_submissions = allow_multiple_submissions;
    if (force_single_category !== undefined) updateData.force_single_category = force_single_category;
    if (require_social_verification !== undefined) updateData.require_social_verification = require_social_verification;
    if (require_mp4_upload !== undefined) updateData.require_mp4_upload = require_mp4_upload;
    if (public_submissions_visibility !== undefined) updateData.public_submissions_visibility = public_submissions_visibility;
    updateData.impact_metric_enabled = false;
    updateData.impact_metric_explanation = null;

    // Validate dates if both provided
    if (updateData.start_date && updateData.end_date) {
      if (new Date(updateData.start_date) >= new Date(updateData.end_date)) {
        return NextResponse.json(
          { error: 'start_date must be before end_date' },
          { status: 400 }
        );
      }
    }

    // Update contest
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('contests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (contestError) {
      if (contestError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      throw contestError;
    }

    // Update categories and prizes if provided
    if (Array.isArray(categories)) {
      // Delete existing categories (this will cascade delete prizes)
      await supabaseAdmin
        .from('contest_categories')
        .delete()
        .eq('contest_id', id);

      // Create new categories with prizes
      if (categories.length > 0) {
        const categoryInserts = categories.map((category: any, index: number) => ({
          contest_id: id,
          name: category.name,
          description: category.description || null,
          rules: category.rules || null,
          display_order: category.display_order || index + 1,
          is_general: category.is_general || false,
          ranking_method: category.ranking_method || 'manual',
        }));

        const { data: createdCategories, error: categoriesError } = await supabaseAdmin
          .from('contest_categories')
          .insert(categoryInserts)
          .select();

        if (categoriesError) {
          console.error('Error updating categories:', categoriesError);
          // Continue anyway - contest is updated
        } else if (createdCategories) {
          // Create prizes within each category
          for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            const categoryId = createdCategories[i].id;

            if (Array.isArray(category.prizes) && category.prizes.length > 0) {
              const placeNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
              const prizeInserts = category.prizes.map((prize: any, index: number) => {
                const rankOrder = prize.rank_order || index + 1;
                const placeName = placeNames[rankOrder - 1] || `${rankOrder}th`;
                return {
                  category_id: categoryId,
                  name: `${placeName} Place`,
                  description: null,
                  payout_amount: prize.payout_amount || 0,
                  rank_order: rankOrder,
                };
              });

              const { error: prizesError } = await supabaseAdmin
                .from('contest_prizes')
                .insert(prizeInserts);

              if (prizesError) {
                console.error('Error updating prizes for category:', prizesError);
                // Continue anyway - categories are created
              }
            }
          }
        }
      }
    }

    // Fetch updated contest with categories and nested prizes
    const { data: contestWithData, error: fetchError } = await supabaseAdmin
      .from('contests')
      .select(`
        *,
        contest_categories (
          id,
          name,
          description,
          rules,
          display_order,
          contest_prizes (
            id,
            name,
            description,
            payout_amount,
            rank_order
          )
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Calculate total prize pool
    const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
      p_contest_id: id,
    });

    return NextResponse.json({
      data: {
        ...contestWithData,
        total_prize_pool: totalPool || 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error updating contest:', error);
    return NextResponse.json(
      { error: 'Failed to update contest' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/contests/[id]
 * Delete contest (only if no submissions exist)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    // Check if contest has submissions
    const { count } = await supabaseAdmin
      .from('contest_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete contest with existing submissions' },
        { status: 400 }
      );
    }

    // Delete contest (prizes will be cascade deleted)
    const { error } = await supabaseAdmin
      .from('contests')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contest not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error deleting contest:', error);
    return NextResponse.json(
      { error: 'Failed to delete contest' },
      { status: 500 }
    );
  }
}

