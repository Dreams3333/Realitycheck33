export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: 'free' | 'premium';
  checksUsedToday: number;
  dailyLimit: number;
  stripeCustomerId?: string;
  trialEndsAt?: string;
  createdAt: string;
}

export type PerspectiveType = 'left' | 'right' | 'historical' | 'scientific' | 'contrarian';

export interface Source {
  title: string;
  url: string;
  domain: string;
}

export interface Perspective {
  type: PerspectiveType;
  label: string;
  summary: string;
  analysis: string;
  sources: Source[];
  isPremiumOnly?: boolean;
}

export interface Claim {
  id: string;
  text: string;
  category: string;
  heatScore: number;
  perspectives: Perspective[];
  commentCount: number;
  viewCount: number;
  submittedByName: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
}

export interface Comment {
  id: string;
  claimId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;
  text: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
