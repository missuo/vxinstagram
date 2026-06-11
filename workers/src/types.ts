export interface Env {
  CACHE: KVNamespace;
}

export interface CachedMedia {
  url: string;
  mediaType: "video" | "image";
  thumbnailUrl: string;
}

export interface CachedPost {
  shortCode: string;
  rawUrl: string;
  authorUsername: string;
  authorName?: string | null;
  avatarUrl?: string | null;
  caption?: string | null;
  trackName?: string | null;
  likes: number;
  comments: number;
  width: number;
  height: number;
  defaultThumbnailUrl?: string | null;
  media: CachedMedia[];
}
