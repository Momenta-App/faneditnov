-- Check if the processed submissions actually created videos in videos_hot

-- Check each of the videos from the recent submissions
SELECT 
  vh.video_id,
  vh.post_id,
  vh.url,
  vh.caption,
  vh.platform,
  vh.is_edit,
  vh.created_at,
  vh.first_seen_at,
  CASE 
    WHEN vh.video_id IS NOT NULL THEN 'EXISTS in videos_hot'
    ELSE 'MISSING from videos_hot'
  END as status
FROM (
  VALUES 
    ('https://www.tiktok.com/@gtinxz/video/7576017518142262535'),
    ('https://www.tiktok.com/@tommytomtommmm/video/7543981402233081110'),
    ('https://www.tiktok.com/@cricketdistrict/video/7211925800981990662'),
    ('https://www.tiktok.com/@alisedit3.0/video/7517399973638556958'),
    ('https://www.tiktok.com/@cricketwithnik/video/7520851638886681912')
) AS urls(url)
LEFT JOIN videos_hot vh ON vh.url = urls.url OR vh.url LIKE '%' || SPLIT_PART(urls.url, '/video/', 2) || '%'
ORDER BY urls.url;

-- Also check by snapshot_id if we can match them
SELECT 
  sm.snapshot_id,
  sm.video_urls[1] as video_url,
  sm.skip_validation,
  sm.created_at as metadata_created_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM videos_hot vh 
      WHERE vh.url = sm.video_urls[1] 
         OR vh.url LIKE '%' || SPLIT_PART(sm.video_urls[1], '/video/', 2) || '%'
    ) THEN 'Video EXISTS'
    ELSE 'Video MISSING'
  END as video_status
FROM submission_metadata sm
WHERE sm.snapshot_id IN (
  'sd_miead50018b24c1ztx',
  'sd_mieackjd1ju29spsck',
  'sd_midc1xgh1flc1qw5uo',
  'sd_midc1mv42oeg8xhct6',
  'sd_midc1ee0283s1ckfgp'
)
ORDER BY sm.created_at DESC;

