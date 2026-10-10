export type BlogKey = "hariharan" | "rajan";

export interface User {
  username: string;
  email: string;
  name: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface AuthState {
  authenticated: boolean;
  user: User | null;
}

export interface Page<T> {
  count: number;
  page: number;
  num_pages: number;
  results: T[];
}

export interface PostSummary {
  title: string;
  slug: string;
  url: string;
  blog: BlogKey;
  author: string;
  category: string | null;
  category_slug: string | null;
  tags: string[];
  summary: string;
  image: string | null;
  published_at: string;
  updated_at: string;
}

export interface PostDetail extends PostSummary {
  content_html: string;
  content_text: string;
  tag_slugs: { name: string; slug: string }[];
  related: { title: string; slug: string }[];
  structured_data: Record<string, unknown>;
  comment_count: number;
}

export interface Comment {
  id: number;
  name: string;
  content: string;
  created_at: string;
}

export interface Category {
  name: string;
  slug: string;
  post_count: number;
}

export type SearchMode = "hybrid" | "semantic" | "keyword";

export interface SearchResult extends PostSummary {
  score: number;
  matched_by: string[];
  snippet: string;
  passages: { heading: string; text: string; score: number }[];
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  count: number;
  results: SearchResult[];
}

export interface KeyPoint {
  point: string;
  why_interesting: string;
}

export interface Article {
  id: number;
  title: string;
  url: string;
  source: { id: number; name: string };
  author: string;
  published_at: string | null;
  reading_minutes: number;
  status: "new" | "enriched" | "basic" | "failed";
  error: string;
  summary: string;
  key_points: KeyPoint[];
  tags: { name: string; slug: string }[];
  difficulty: string;
  difficulty_display: string;
  content_type: string;
  relevance: number;
  relevance_reason: string;
  worth_deep_read: boolean;
  is_read: boolean;
  is_starred: boolean;
}

export interface Takeaway {
  title: string;
  explanation: string;
  source_urls: string[];
}

export interface Digest {
  date: string;
  headline: string;
  intro: string;
  takeaways: Takeaway[];
  try_today: string;
  generated_by: string;
  updated_at: string;
  articles: Article[];
}

export interface DigestSummary {
  date: string;
  headline: string;
}

export interface Source {
  id: number;
  name: string;
  kind: string;
  kind_display: string;
  site_url: string;
  feed_url: string;
  is_active: boolean;
  last_fetched_at: string | null;
  last_error: string;
}

export interface Interest {
  id: number;
  name: string;
  weight: number;
}
