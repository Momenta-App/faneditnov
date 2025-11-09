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
  website?: string;
  location?: string;
  joinedDate: string;
}

export interface Video {
  id: string;
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
  duration: number;
  createdAt: string;
  sound?: {
    title: string;
    author: string;
  };
  hashtags: string[];
}

export interface Hashtag {
  id: string;
  name: string;
  views: number;
  videos: number;
  trending: boolean;
  description?: string;
}

export interface Sound {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  videos: number;
}

export const mockCreators: Creator[] = [
  {
    id: '1',
    username: 'dancequeen',
    displayName: 'Dance Queen',
    bio: 'Daily dance tutorials & choreography 🎵✨',
    avatar: 'https://ui-avatars.com/api/?name=Dance+Queen&background=120F23&color=fff&size=128',
    verified: true,
    followers: 2500000,
    videos: 342,
    likes: 45000000,
    website: 'https://dancequeen.com',
    location: 'Los Angeles, CA',
    joinedDate: '2021-03-15',
  },
  {
    id: '2',
    username: 'cookingpro',
    displayName: 'Chef Alex',
    bio: 'Quick & easy recipes for busy people 🍳',
    avatar: 'https://ui-avatars.com/api/?name=Chef+Alex&background=7c3aed&color=fff&size=128',
    verified: true,
    followers: 1800000,
    videos: 456,
    likes: 32000000,
    location: 'New York, NY',
    joinedDate: '2020-11-22',
  },
  {
    id: '3',
    username: 'travelvlog',
    displayName: 'World Explorer',
    bio: 'Travel tips, hidden gems & adventures 🌍✈️',
    avatar: 'https://ui-avatars.com/api/?name=World+Explorer&background=ec4899&color=fff&size=128',
    verified: false,
    followers: 950000,
    videos: 289,
    likes: 15000000,
    joinedDate: '2022-01-08',
  },
];

export const mockVideos: Video[] = [
  {
    id: '1',
    title: 'Learn the Viral Dance in 60 Seconds!',
    description: 'Breakdown of the latest trending dance move',
    thumbnail: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=600&fit=crop',
    videoUrl: '#',
    creator: {
      id: '1',
      username: 'dancequeen',
      avatar: 'https://ui-avatars.com/api/?name=Dance+Queen&background=120F23&color=fff',
      verified: true,
    },
    views: 2500000,
    likes: 450000,
    comments: 12500,
    shares: 9800,
    duration: 62,
    createdAt: '2024-01-15T10:30:00Z',
    sound: {
      title: 'Trending Beat',
      author: 'DJ Fresh',
    },
    hashtags: ['#dance', '#viral', '#tutorial'],
  },
  {
    id: '2',
    title: '5-Minute Pasta Recipe',
    description: 'Quick and delicious pasta recipe for busy weeknights',
    thumbnail: 'https://images.unsplash.com/photo-1563379091339-03246963d2c8?w=400&h=600&fit=crop',
    videoUrl: '#',
    creator: {
      id: '2',
      username: 'cookingpro',
      avatar: 'https://ui-avatars.com/api/?name=Chef+Alex&background=7c3aed&color=fff',
      verified: true,
    },
    views: 1800000,
    likes: 320000,
    comments: 8900,
    shares: 5600,
    duration: 312,
    createdAt: '2024-01-14T18:00:00Z',
    sound: {
      title: 'Kitchen Vibes',
      author: 'Cooking Sounds',
    },
    hashtags: ['#cooking', '#recipe', '#pasta'],
  },
  {
    id: '3',
    title: 'Hidden Beach in Greece 🇬🇷',
    description: 'Most beautiful beach I have ever seen',
    thumbnail: 'https://images.unsplash.com/photo-1612477964405-67b37a9640a0?w=400&h=600&fit=crop',
    videoUrl: '#',
    creator: {
      id: '3',
      username: 'travelvlog',
      avatar: 'https://ui-avatars.com/api/?name=World+Explorer&background=ec4899&color=fff',
      verified: false,
    },
    views: 950000,
    likes: 150000,
    comments: 4500,
    shares: 3200,
    duration: 45,
    createdAt: '2024-01-13T14:20:00Z',
    hashtags: ['#travel', '#greece', '#beach'],
  },
];

export const mockHashtags: Hashtag[] = [
  {
    id: '1',
    name: 'fyp',
    views: 5000000000,
    videos: 12000000,
    trending: true,
    description: 'For You Page',
  },
  {
    id: '2',
    name: 'viral',
    views: 2500000000,
    videos: 8500000,
    trending: true,
    description: 'Going viral',
  },
  {
    id: '3',
    name: 'dance',
    views: 1800000000,
    videos: 6200000,
    trending: false,
    description: 'Dance videos',
  },
  {
    id: '4',
    name: 'cooking',
    views: 950000000,
    videos: 3400000,
    trending: false,
    description: 'Cooking tips and recipes',
  },
];

export const mockSounds: Sound[] = [
  {
    id: '1',
    title: 'Trending Beat',
    author: 'DJ Fresh',
    duration: 60,
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    videos: 85000,
  },
  {
    id: '2',
    title: 'Kitchen Vibes',
    author: 'Cooking Sounds',
    duration: 120,
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    videos: 42000,
  },
  {
    id: '3',
    title: 'Summer Waves',
    author: 'Beach Vibes',
    duration: 180,
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    videos: 68000,
  },
];

