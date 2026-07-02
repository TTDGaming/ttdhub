export type Platform = 'youtube' | 'tiktok' | 'facebook';

export interface AccountStats {
  takenAt: number;
  views: number | null;
  followers: number | null;
  likes: number | null;
  videos: number | null;
  views48h: number | null;
  followers48h: number | null;
  likes48h: number | null;
}

export interface Account {
  id: number;
  platform: Platform;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  external_id: string | null;
  page_url: string | null;
  status: 'connecting' | 'active' | 'error';
  note: string | null;
  created_at: number;
  stats: AccountStats | null;
}

export interface OverviewAccount {
  id: number;
  platform: Platform;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  views: number | null;
  followers: number | null;
  likes: number | null;
  views48h: number;
  followers48h: number;
  spark: { t: number; v: number }[];
}

export interface Overview {
  accountCount: number;
  totalViews: number;
  totalFollowers: number;
  views48h: number;
  followers48h: number;
  jobs: { queued: number; uploading: number; done48h: number; errors: number };
  accounts: OverviewAccount[];
}

export interface UploadJob {
  id: number;
  batch_id: number | null;
  account_id: number;
  account_name: string | null;
  platform: Platform;
  avatar_url: string | null;
  original_name: string | null;
  title: string;
  description: string | null;
  tags: string | null;
  privacy: 'public' | 'unlisted' | 'private';
  schedule_at: number | null;
  status: 'queued' | 'uploading' | 'done' | 'error' | 'canceled';
  progress: number;
  error: string | null;
  remote_url: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
}

export interface HistoryPoint {
  t: number;
  views: number | null;
  followers: number | null;
  likes: number | null;
  videos: number | null;
}
