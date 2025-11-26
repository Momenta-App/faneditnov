/**
 * Admin API routes for contest management
 * GET: List all contests (admin only)
 * POST: Create new contest (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleAuthError, AuthError } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contests
 * List all contests with stats
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // Filter by status

    let query = supabaseAdmin
      .from('contests')
      .select(`
        *,
        contest_categories (
          id,
          name,
          display_order,
          is_general,
          ranking_method,
          contest_prizes (
            id,
            name,
            payout_amount,
            rank_order
          )
        ),
        contest_asset_links (
          id,
          name,
          url,
          display_order
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: contests, error } = await query;

    if (error) throw error;

    // Get submission counts and total prize pool for each contest
    const contestsWithStats = await Promise.all(
      (contests || []).map(async (contest) => {
        const { count: totalSubmissions } = await supabaseAdmin
          .from('contest_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest.id);

        const { count: verifiedSubmissions } = await supabaseAdmin
          .from('contest_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest.id)
          .eq('verification_status', 'verified');

        const { count: pendingReview } = await supabaseAdmin
          .from('contest_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', contest.id)
          .in('content_review_status', ['pending']);

        // Calculate total prize pool
        const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
          p_contest_id: contest.id,
        });

        return {
          ...contest,
          total_prize_pool: totalPool || 0,
          stats: {
            total_submissions: totalSubmissions || 0,
            verified_submissions: verifiedSubmissions || 0,
            pending_review: pendingReview || 0,
          },
        };
      })
    );

    // Get total count
    let countQuery = supabaseAdmin
      .from('contests')
      .select('*', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      data: contestsWithStats,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error fetching contests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/contests
 * Create a new contest
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    const body = await request.json();
    const {
      title,
      description,
      movie_identifier,
      slug,
      start_date,
      end_date,
      required_hashtags,
      required_description_template,
      prizes,
      categories,
      status = 'upcoming',
      allow_multiple_submissions = true,
      force_single_category = false,
      require_social_verification = false,
      require_mp4_upload = false,
      public_submissions_visibility = 'public_hide_metrics',
      profile_image_url,
      cover_image_url,
      display_stats = true,
      asset_links,
    } = body;

    // Validation
    if (!title || !description || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, start_date, end_date' },
        { status: 400 }
      );
    }

    if (!Array.isArray(required_hashtags) || required_hashtags.length === 0) {
      return NextResponse.json(
        { error: 'At least one required hashtag is required' },
        { status: 400 }
      );
    }

    if (new Date(start_date) >= new Date(end_date)) {
      return NextResponse.json(
        { error: 'start_date must be before end_date' },
        { status: 400 }
      );
    }

    if (!['upcoming', 'live', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid contest status' }, { status: 400 });
    }

    if (!['public_hide_metrics', 'public_with_rankings', 'private_judges_only'].includes(public_submissions_visibility)) {
      return NextResponse.json({ error: 'Invalid public submissions visibility' }, { status: 400 });
    }

    // Create contest
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('contests')
      .insert({
        created_by: user.id,
        title,
        description,
        movie_identifier: movie_identifier || null,
        slug: slug || null,
        start_date,
        end_date,
        required_hashtags,
        required_description_template: required_description_template || null,
        status,
        allow_multiple_submissions,
        force_single_category,
        require_social_verification,
        require_mp4_upload,
        public_submissions_visibility,
        profile_image_url: profile_image_url || null,
        cover_image_url: cover_image_url || null,
        display_stats,
        impact_metric_enabled: false,
        impact_metric_explanation: null,
      })
      .select()
      .single();

    if (contestError) throw contestError;

    // Create categories first (if provided), then create prizes within categories
    if (Array.isArray(categories) && categories.length > 0) {
      // Create categories
      const categoryInserts = categories.map((category: any, index: number) => ({
        contest_id: contest.id,
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
        console.error('Error creating categories:', categoriesError);
        throw categoriesError;
      }

      // Create prizes within each category
      if (createdCategories) {
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
              console.error('Error creating prizes for category:', prizesError);
              // Continue anyway - categories are created
            }
          }
        }
      }
    }

    // Create asset links if provided
    if (Array.isArray(asset_links) && asset_links.length > 0) {
      const assetLinkInserts = asset_links.map((link: any, index: number) => ({
        contest_id: contest.id,
        name: link.name,
        url: link.url,
        display_order: link.display_order ?? index,
      }));

      const { error: assetLinksError } = await supabaseAdmin
        .from('contest_asset_links')
        .insert(assetLinkInserts);

      if (assetLinksError) {
        console.error('Error creating asset links:', assetLinksError);
        // Continue anyway - contest is created
      }
    }

    // Fetch contest with categories and nested prizes
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
      .eq('id', contest.id)
      .single();

    if (fetchError) throw fetchError;

    // Calculate total prize pool
    const { data: totalPool } = await supabaseAdmin.rpc('get_contest_total_prize_pool', {
      p_contest_id: contest.id,
    });

    return NextResponse.json({
      data: {
        ...contestWithData,
        total_prize_pool: totalPool || 0,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    console.error('Error creating contest:', error);
    return NextResponse.json(
      { error: 'Failed to create contest' },
      { status: 500 }
    );
  }
}

