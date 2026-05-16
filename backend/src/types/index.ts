export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  password_hash?: string;
  google_id?: string;
  tier: 'free' | 'premium';
  checks_used_today: number;
  daily_limit: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  trial_ends_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Claim {
  id: string;
  text: string;
  category: string;
  heat_score: number;
  submitted_by: string;
  view_count: number;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  created_at: Date;
}

export interface Perspective {
  id: string;
  claim_id: string;
  type: 'left' | 'right' | 'historical' | 'scientific' | 'contrarian';
  label: string;
  summary: string;
  analysis: string;
  sources: Source[];
  is_premium_only: boolean;
  created_at: Date;
}

export interface Source {
  title: string;
  url: string;
  domain: string;
}

export interface Comment {
  id: string;
  claim_id: string;
  user_id: string;
  text: string;
  likes: number;
  created_at: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; tier: string };
    }
  }
}
