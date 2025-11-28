-- Debug why processed videos aren't being ingested

-- 1. Check if submission_metadata still exists (should be deleted after webhook processes it)
SELECT 
  snapshot_id,
  video_urls,
  skip_validation,
  created_at,
  CASE 
    WHEN snapshot_id LIKE 'pending_%' THEN 'Still pending'
    ELSE 'Processed by BrightData'
  END as status
FROM submission_metadata
WHERE snapshot_id IN (
  'sd_miead50018b24c1ztx',
  'sd_mieackjd1ju29spsck',
  'sd_midc1xgh1flc1qw5uo',
  'sd_midc1ee0283s1ckfgp',
  'pending_1764318197771_gw8pmgs2j'
)
ORDER BY created_at DESC;

-- 2. Check if videos exist by URL matching (in case video_id doesn't match)
SELECT 
  vh.video_id,
  vh.url,
  vh.is_edit,
  vh.first_seen_at
FROM videos_hot vh
WHERE vh.url LIKE '%7576017518142262535%'
   OR vh.url LIKE '%7543981402233081110%'
   OR vh.url LIKE '%7211925800981990662%'
   OR vh.url LIKE '%7520851638886681912%'
   OR vh.url LIKE '%7396037000240942379%'
ORDER BY vh.first_seen_at DESC;

-- 3. Check if there are any errors in the ingestion function
-- (This would require checking server logs, but we can check if videos were rejected)
SELECT 
  post_id,
  tiktok_url,
  rejection_reason,
  rejected_at
FROM rejected_videos
WHERE tiktok_url LIKE '%7576017518142262535%'
   OR tiktok_url LIKE '%7543981402233081110%'
   OR tiktok_url LIKE '%7211925800981990662%'
   OR tiktok_url LIKE '%7520851638886681912%'
   OR tiktok_url LIKE '%7396037000240942379%'
ORDER BY rejected_at DESC;

