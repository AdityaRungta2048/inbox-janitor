export type Provider = 'microsoft' | 'google';

export interface AuthTokens {
  provider: Provider;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  userId: string;
  userEmail: string;
  userName: string;
}

export interface SenderGroup {
  email: string;
  name: string;
  count: number;
  latestDate: string; // ISO 8601
  representativeMessageId: string;
}

export type SortKey = 'count' | 'date' | 'alpha';

export interface SenderCache {
  provider: Provider;
  groups: SenderGroup[];
  fetchedAt: number; // Unix ms
  totalFetched: number;
  isPartial: boolean; // true when we stopped before exhausting nextLink
}

export interface UnsubscribeHeader {
  httpsUrl: string | null;
  mailtoUrl: string | null;
  isOneClick: boolean; // List-Unsubscribe-Post: List-Unsubscribe=One-Click
}

export type UnsubscribeStatus =
  | 'idle'
  | 'fetching_header'
  | 'one_click_sending'
  | 'done'
  | 'opened_in_tab'
  | 'needs_manual'
  | 'no_header'
  | 'failed';

export interface UnsubscribeResult {
  email: string;
  status: UnsubscribeStatus;
  message?: string;
}

export interface BatchResult {
  id: string;
  status: number;
  body?: unknown;
}

export interface GraphMessage {
  id: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  subject?: string;
  receivedDateTime?: string;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
}

export interface GraphListResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

export type AppState =
  | { view: 'signed_out' }
  | { view: 'loading'; message: string }
  | { view: 'sender_list'; cache: SenderCache }
  | { view: 'error'; message: string };
