# Database Verification Report

**Generated:** 11/19/2025, 8:27:27 PM

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Tables Verified | 40 |
| ✅ Complete | 35 |
| ⚠️ Missing Data | 5 |
| ⚠️ Extra Data | 0 |
| ❌ Errors | 0 |
| ❌ Not in Target | 0 |

**Completion Rate:** 87.5%

⚠️ **Action Required:** 5 tables need attention.

---

## ✅ Complete Tables (35)

| Table Name | Target | Schema Source | Data Source | Expected | Status |
|------------|--------|--------------|-------------|----------|--------|
| `creators_hot` | 3013 | 0 | 3013 | 3013 | ✅ |
| `videos_hot` | 8217 | 0 | 8217 | 8217 | ✅ |
| `sounds_hot` | 7178 | 0 | 7178 | 7178 | ✅ |
| `hashtags_hot` | 6429 | 0 | 6429 | 6429 | ✅ |
| `creators_cold` | 3013 | 0 | 3013 | 3013 | ✅ |
| `creator_profiles_cold` | 3013 | 0 | 3013 | 3013 | ✅ |
| `videos_cold` | 8217 | 0 | 8217 | 8217 | ✅ |
| `sounds_cold` | 7178 | 0 | 7178 | 7178 | ✅ |
| `hashtags_cold` | 6429 | 0 | 6429 | 6429 | ✅ |
| `video_sound_facts` | 8217 | 0 | 8217 | 8217 | ✅ |
| `video_hashtag_facts` | 42262 | 0 | 42262 | 42262 | ✅ |
| `creator_video_facts` | 0 | 0 | 0 | 0 | ✅ |
| `raw_refs` | 0 | 0 | 0 | 0 | ✅ |
| `video_creator_mentions` | 0 | 0 | 0 | 0 | ✅ |
| `communities` | 19 | 0 | 19 | 19 | ✅ |
| `community_hashtag_memberships` | 192 | 0 | 192 | 192 | ✅ |
| `video_metrics_timeseries` | 0 | 0 | 0 | 0 | ✅ |
| `creator_metrics_timeseries` | 0 | 0 | 0 | 0 | ✅ |
| `sound_metrics_timeseries` | 0 | 0 | 0 | 0 | ✅ |
| `hashtag_metrics_timeseries` | 0 | 0 | 0 | 0 | ✅ |
| `video_play_count_history` | 8217 | 0 | 8217 | 8217 | ✅ |
| `leaderboards_creators` | 0 | 0 | 0 | 0 | ✅ |
| `leaderboards_videos` | 0 | 0 | 0 | 0 | ✅ |
| `leaderboards_sounds` | 0 | 0 | 0 | 0 | ✅ |
| `leaderboards_hashtags` | 0 | 0 | 0 | 0 | ✅ |
| `rejected_videos` | 313 | 0 | 313 | 313 | ✅ |
| `submission_metadata` | 24 | 0 | 24 | 24 | ✅ |
| `bd_ingestions` | 0 | 0 | 0 | 0 | ✅ |
| `hashtag_daily_stats` | 32329 | 0 | 32329 | 32329 | ✅ |
| `creator_daily_stats` | 5722 | 0 | 5722 | 5722 | ✅ |
| `sound_daily_stats` | 8092 | 0 | 8092 | 8092 | ✅ |
| `homepage_cache` | 1 | 0 | 1 | 1 | ✅ |
| `creator_contacts` | 0 | 0 | 0 | 0 | ✅ |
| `brand_contact_submissions` | 1 | 0 | 1 | 1 | ✅ |
| `auth_rate_limits` | 65 | 0 | 65 | 65 | ✅ |

## ⚠️ Tables with Missing Data (5)

| Table Name | Target | Expected | Missing | Issues |
|------------|--------|----------|--------|--------|
| `community_video_memberships` | 2000 | 3975 | 1975 | Missing 1975 rows (target: 2000, expected: 3975) |
| `community_creator_memberships` | 1248 | 2248 | 1000 | Missing 1000 rows (target: 1248, expected: 2248) |
| `profiles` | 0 | 34 | 34 | Missing 34 rows (target: 0, expected: 34) |
| `user_daily_quotas` | 0 | 14 | 14 | Missing 14 rows (target: 0, expected: 14) |
| `community_daily_stats` | 1106 | 2106 | 1000 | Missing 1000 rows (target: 1106, expected: 2106) |

### Details

#### `community_video_memberships`

- **Target Count:** 2000
- **Schema Source Count:** 0
- **Data Source Count:** 3975
- **Expected Total:** 3975
- **Missing:** 1975 rows

**Issues:**
- Missing 1975 rows (target: 2000, expected: 3975)

#### `community_creator_memberships`

- **Target Count:** 1248
- **Schema Source Count:** 0
- **Data Source Count:** 2248
- **Expected Total:** 2248
- **Missing:** 1000 rows

**Issues:**
- Missing 1000 rows (target: 1248, expected: 2248)

#### `profiles`

- **Target Count:** 0
- **Schema Source Count:** 0
- **Data Source Count:** 34
- **Expected Total:** 34
- **Missing:** 34 rows

**Issues:**
- Missing 34 rows (target: 0, expected: 34)

#### `user_daily_quotas`

- **Target Count:** 0
- **Schema Source Count:** 0
- **Data Source Count:** 14
- **Expected Total:** 14
- **Missing:** 14 rows

**Issues:**
- Missing 14 rows (target: 0, expected: 14)

#### `community_daily_stats`

- **Target Count:** 1106
- **Schema Source Count:** 0
- **Data Source Count:** 2106
- **Expected Total:** 2106
- **Missing:** 1000 rows

**Issues:**
- Missing 1000 rows (target: 1106, expected: 2106)


---

## Recommendations

### Immediate Actions

1. **Run migration script:** Execute `npx tsx scripts/migrate-missing-data.ts` to migrate missing data
3. **Re-run verification:** After migration, run `npx tsx scripts/verify-all-data.ts` again

---

## Table Categories Breakdown

### Core Hot Tables

| Table Name | Status | Target | Expected |
|------------|--------|--------|----------|
| `creators_hot` | ✅ complete | 3013 | 3013 |
| `videos_hot` | ✅ complete | 8217 | 8217 |
| `sounds_hot` | ✅ complete | 7178 | 7178 |
| `hashtags_hot` | ✅ complete | 6429 | 6429 |

### Core Cold Tables

| Table Name | Status | Target | Expected |
|------------|--------|--------|----------|
| `creators_cold` | ✅ complete | 3013 | 3013 |
| `creator_profiles_cold` | ✅ complete | 3013 | 3013 |
| `videos_cold` | ✅ complete | 8217 | 8217 |
| `sounds_cold` | ✅ complete | 7178 | 7178 |
| `hashtags_cold` | ✅ complete | 6429 | 6429 |

### Fact/Relationship Tables

| Table Name | Status | Target | Expected |
|------------|--------|--------|----------|
| `video_sound_facts` | ✅ complete | 8217 | 8217 |
| `video_hashtag_facts` | ✅ complete | 42262 | 42262 |
| `creator_video_facts` | ✅ complete | 0 | 0 |
| `raw_refs` | ✅ complete | 0 | 0 |
| `video_creator_mentions` | ✅ complete | 0 | 0 |

### Communities Tables

| Table Name | Status | Target | Expected |
|------------|--------|--------|----------|
| `communities` | ✅ complete | 19 | 19 |
| `community_video_memberships` | ⚠️ missing | 2000 | 3975 |
| `community_creator_memberships` | ⚠️ missing | 1248 | 2248 |
| `community_hashtag_memberships` | ✅ complete | 192 | 192 |

### Time Series Tables

| Table Name | Status | Target | Expected |
|------------|--------|--------|----------|
| `video_metrics_timeseries` | ✅ complete | 0 | 0 |
| `creator_metrics_timeseries` | ✅ complete | 0 | 0 |
| `sound_metrics_timeseries` | ✅ complete | 0 | 0 |
| `hashtag_metrics_timeseries` | ✅ complete | 0 | 0 |
| `video_play_count_history` | ✅ complete | 8217 | 8217 |

### Other Tables

| Table Name | Status | Target | Expected |
|------------|--------|--------|----------|
| `leaderboards_creators` | ✅ complete | 0 | 0 |
| `leaderboards_videos` | ✅ complete | 0 | 0 |
| `leaderboards_sounds` | ✅ complete | 0 | 0 |
| `leaderboards_hashtags` | ✅ complete | 0 | 0 |
| `rejected_videos` | ✅ complete | 313 | 313 |
| `submission_metadata` | ✅ complete | 24 | 24 |
| `bd_ingestions` | ✅ complete | 0 | 0 |
| `profiles` | ⚠️ missing | 0 | 34 |
| `user_daily_quotas` | ⚠️ missing | 0 | 14 |
| `hashtag_daily_stats` | ✅ complete | 32329 | 32329 |
| `creator_daily_stats` | ✅ complete | 5722 | 5722 |
| `sound_daily_stats` | ✅ complete | 8092 | 8092 |
| `community_daily_stats` | ⚠️ missing | 1106 | 2106 |
| `homepage_cache` | ✅ complete | 1 | 1 |
| `creator_contacts` | ✅ complete | 0 | 0 |
| `brand_contact_submissions` | ✅ complete | 1 | 1 |
| `auth_rate_limits` | ✅ complete | 65 | 65 |

---

## Next Steps

1. Review this report for any issues
2. Run `npx tsx scripts/migrate-missing-data.ts` to fill gaps
3. Run `npx tsx scripts/migrate-communities-data.ts` for communities-specific data
4. Re-run verification: `npx tsx scripts/verify-all-data.ts`
5. Verify foreign key integrity
6. Run aggregation functions if needed
7. Test application with migrated data

---

*Report generated by database verification system*
