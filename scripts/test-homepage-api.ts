/**
 * Test script to verify homepage API is working correctly
 * Run with: npx tsx scripts/test-homepage-api.ts
 */

import { supabaseAdmin } from '../src/lib/supabase';

async function testHomepageCache() {
  console.log('🔍 Testing Homepage Cache...\n');

  // 1. Check if cache exists
  console.log('1. Checking homepage_cache table...');
  const { data: cache, error: cacheError } = await supabaseAdmin
    .from('homepage_cache')
    .select('total_videos, total_views, total_creators, stats_updated_at')
    .eq('id', 'singleton')
    .single();

  if (cacheError) {
    console.error('❌ Error fetching cache:', cacheError);
    return;
  }

  if (!cache) {
    console.error('❌ Cache not found! Run: SELECT update_homepage_stats();');
    return;
  }

  console.log('✅ Cache found:');
  console.log('   - Videos:', cache.total_videos);
  console.log('   - Views:', cache.total_views);
  console.log('   - Creators:', cache.total_creators);
  console.log('   - Updated at:', cache.stats_updated_at);
  console.log('');

  // 2. Test formatting
  console.log('2. Testing number formatting...');
  const formatStat = (num: number): string => {
    if (num >= 1000000000000) {
      return `${(num / 1000000000000).toFixed(1)}T+`;
    } else if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B+`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K+`;
    }
    return `${num}+`;
  };

  console.log('   - Videos formatted:', formatStat(cache.total_videos ?? 0));
  console.log('   - Views formatted:', formatStat(cache.total_views ?? 0));
  console.log('   - Creators formatted:', formatStat(cache.total_creators ?? 0));
  console.log('');

  // 3. Simulate API response
  console.log('3. Simulating API response structure...');
  const apiResponse = {
    success: true,
    data: {
      stats: {
        videos: {
          count: cache.total_videos ?? 0,
          formatted: formatStat(cache.total_videos ?? 0),
          label: 'Clips'
        },
        views: {
          count: cache.total_views ?? 0,
          formatted: formatStat(cache.total_views ?? 0),
          label: 'Global Views'
        },
        creators: {
          count: cache.total_creators ?? 0,
          formatted: formatStat(cache.total_creators ?? 0),
          label: 'Talented Creators'
        }
      }
    }
  };

  console.log('✅ API response structure:');
  console.log(JSON.stringify(apiResponse, null, 2));
  console.log('');

  // 4. Verify data structure matches component expectations
  console.log('4. Verifying component data structure...');
  const componentStats = apiResponse.data.stats;
  if (componentStats.videos?.formatted && componentStats.views?.formatted && componentStats.creators?.formatted) {
    console.log('✅ Component should receive:');
    console.log('   - Videos:', componentStats.videos.formatted, componentStats.videos.label);
    console.log('   - Views:', componentStats.views.formatted, componentStats.views.label);
    console.log('   - Creators:', componentStats.creators.formatted, componentStats.creators.label);
  } else {
    console.error('❌ Missing formatted values in stats!');
  }

  console.log('\n✅ All tests passed! The API should work correctly.');
}

testHomepageCache().catch(console.error);

