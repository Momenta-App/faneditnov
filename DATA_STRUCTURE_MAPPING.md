# Bright Data API Data Structure Mapping

This document maps the field differences between Instagram and YouTube data from Bright Data.

## Platform Detection

The system detects platform from the URL:
- Instagram: URLs contain `instagram.com`
- YouTube: URLs contain `youtube.com` or `youtu.be`

## Field Mappings

### Video/Post ID
- **Instagram**: `post_id`, `shortcode`
- **YouTube**: `video_id`, `shortcode`

### Creator/Channel ID
- **Instagram**: `user_posted` (username), `profile_id`
- **YouTube**: `youtuber_id` (channel ID like `UCW8Q9LBGGBgK6a-u0C0h95A`), `youtuber` (username)

### Views/Play Count
- **Instagram**: `views`, `video_play_count`, `play_count`
- **YouTube**: `views`

### Likes
- **Instagram**: `likes`, `digg_count`
- **YouTube**: `likes`

### Comments
- **Instagram**: `num_comments`, `comment_count`
- **YouTube**: `num_comments`

### Shares
- **Instagram**: `share_count`
- **YouTube**: Not available (set to 0)

### Hashtags
- **Instagram**: `hashtags` - can be `null`, array of strings, or different format
- **YouTube**: `hashtags` - array of objects: `[{"hashtag": "#tag", "link": "..."}]`

### Music/Sound
- **Instagram**: `music.id`, `music.music_id`, `audio_url`
- **YouTube**: `music.artist`, `music.song` (no ID field)

### Video Duration
- **Instagram**: `length` (string like "16.443")
- **YouTube**: `video_length` (integer in seconds)

### Thumbnail/Cover
- **Instagram**: `thumbnail`
- **YouTube**: `preview_image`

### Description/Caption
- **Instagram**: `description`
- **YouTube**: `description`, `title`

### Date Posted
- **Instagram**: `date_posted`
- **YouTube**: `date_posted`
- Both use ISO 8601 format

### Creator Profile
- **Instagram**: `user_posted` (username), `profile_image_link` (avatar)
- **YouTube**: `youtuber` (username with @), `youtuber_id` (channel ID), `avatar_img_channel` (avatar)

## Implementation Notes

The ingestion function (`ingest_brightdata_snapshot_v2`) needs to:
1. Detect platform from URL
2. Extract fields using platform-specific logic
3. Normalize hashtags (YouTube objects → strings)
4. Handle missing fields gracefully (YouTube has no shares)
5. Map creator IDs appropriately (Instagram uses username, YouTube uses channel ID)

