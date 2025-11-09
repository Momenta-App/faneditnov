// Types matching database schema
export interface Creator {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatar: string;
  verified: boolean;
  followers: number;
  videos: number;
  likes: number;
  views: number;
  impact: number;  // Impact score
}

export interface Video {
  id: string;
  postId: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  creator: {
    id: string;
    username: string;
    avatar: string;
    verified: boolean;
  };
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;  // Collect count
  impact: number;  // Impact score
  duration: number;
  createdAt: string;
  hashtags: string[];
}

export interface Hashtag {
  id: string;
  name: string;
  views: number;
  videos: number;
  trending: boolean;
  description?: string;
  creators?: number;
  impact: number;  // Impact score
}

export interface Sound {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  videos: number;
  views: number;
  likes?: number;
  impact: number;  // Impact score
}

export interface HashtagCreator {
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  verified: boolean;
  bio: string;
  total_views: number;
  video_count: number;
}

export interface SoundCreator {
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  verified: boolean;
  bio: string;
  total_views: number;  // Total views for this sound
  video_count: number;  // Number of videos using this sound
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  profile_image_url?: string;
  cover_image_url?: string;
  description?: string;
  linked_hashtags: string[];
  links: {
    website?: string;
    x?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    other?: string;
  };
  total_views: number;
  total_videos: number;
  total_creators: number;
  total_likes: number;
  total_impact_score: number;  // Impact score
  created_at: string;
  updated_at: string;
}

export interface CommunityCreator {
  creator_id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  verified: boolean;
  bio?: string;
  total_views: number;
  total_impact_score: number;  // Impact score
  video_count: number;
}

export interface CommunityHashtag {
  hashtag: string;
  hashtag_norm: string;
  total_views: number;
  video_count: number;
  global_views: number;
  global_videos: number;
}

export type UserRole = 'standard' | 'creator' | 'brand' | 'admin';

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  role: UserRole;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

