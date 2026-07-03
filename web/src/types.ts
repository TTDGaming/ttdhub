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

export interface AccountIdentity {
  id: number;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  kind: 'manager' | 'single';
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
  monetized: 'yes' | 'no' | 'unknown';
  rpm: number | null;
  role: 'owner' | 'manager' | 'self';
  is_manager: number;
  tags: string[];
  identity: AccountIdentity | null;
  identity_id: number | null;
  created_at: number;
  stats: AccountStats | null;
}

export interface Identity {
  id: number;
  platform: Platform;
  kind: 'manager' | 'single';
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  status: 'connecting' | 'active' | 'error';
  lastSyncedAt: number | null;
  channelCount: number;
  managedCount: number;
}

export interface ChannelVideo {
  id: number;
  externalId: string;
  title: string | null;
  thumbnailUrl: string | null;
  url: string | null;
  publishedAt: number | null;
  publishedText: string | null;
  duration: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  privacy: string | null;
  scrapedAt: number;
}

export interface ChannelComment {
  id: number;
  externalId: string;
  videoTitle: string | null;
  author: string | null;
  authorAvatar: string | null;
  text: string | null;
  likes: number | null;
  replied: boolean;
  publishedText: string | null;
  scrapedAt: number;
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
  status: 'active' | 'error';
  monetized: 'yes' | 'no' | 'unknown';
  spark: { t: number; v: number }[];
}

export interface RevenueAccount {
  id: number;
  name: string | null;
  platform: Platform;
  avatarUrl: string | null;
  monetized: 'yes' | 'no' | 'unknown';
  rpm: number | null;
  views30d: number | null;
  est30: number | null;
  recordedThisMonth: number;
  recorded12m: number;
}

export interface RevenueSummary {
  currency: string;
  thisMonth: string;
  totals: {
    recordedThisMonth: number;
    est30: number;
    recorded12m: number;
    monetizedCount: number;
    accountCount: number;
  };
  monthly: { month: string; total: number }[];
  accounts: RevenueAccount[];
}

export interface RevenueEntry {
  id: number;
  account_id: number;
  account_name: string | null;
  platform: Platform;
  month: string;
  amount: number;
  note: string | null;
  created_at: number;
}

export interface ManagerReportChannel {
  id: number;
  name: string | null;
  platform: Platform;
  avatarUrl: string | null;
  role: 'owner' | 'manager' | 'self';
  monetized: 'yes' | 'no' | 'unknown';
  status: string;
  views: number | null;
  followers: number | null;
  videos: number | null;
  views48h: number;
  followers48h: number;
  est30: number | null;
  recordedThisMonth: number;
}

export interface ManagerReport {
  identity: {
    id: number;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    platform: Platform;
    channelCount: number;
    lastSyncedAt: number | null;
  };
  currency: string;
  thisMonth: string;
  totals: {
    channels: number;
    managed: number;
    totalViews: number;
    totalFollowers: number;
    totalVideos: number;
    views48h: number;
    followers48h: number;
    est30: number;
    recordedThisMonth: number;
    recorded12m: number;
    monetizedCount: number;
  };
  monthly: { month: string; total: number }[];
  channels: ManagerReportChannel[];
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

export interface AppNotification {
  id: number;
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string | null;
  link: string | null;
  accountId: number | null;
  read: boolean;
  createdAt: number;
}

export interface HistoryPoint {
  t: number;
  views: number | null;
  followers: number | null;
  likes: number | null;
  videos: number | null;
}
