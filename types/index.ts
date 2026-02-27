export type VerificationStatus = 'none' | 'pending' | 'rejected' | 'verified';

export interface Profile {
  id: string;
  display_name: string;
  country_code: string;
  avatar_url: string;
  bio: string | null;
  instagram_handle: string | null;
  verification_status: VerificationStatus;
  push_token: string | null;
  events_hosted_count: number;
  created_at: string;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}
