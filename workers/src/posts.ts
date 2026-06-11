import { snapsave } from "snapsave-media-downloader";
import type { CachedPost, Env } from "./types";

const CACHE_TTL_SECONDS = 4 * 3600;

/**
 * Fetches an Instagram post via snapsave (in-process — no Node sidecar)
 * and caches the normalized result in Workers KV for 4 hours.
 */
export async function getOrFetchPost(
  env: Env,
  cacheId: string,
  instagramUrl: string,
): Promise<CachedPost | null> {
  const key = `post:${cacheId}`;
  const cached = await env.CACHE.get<CachedPost>(key, "json");
  if (cached) return cached;

  try {
    const result = await snapsave(instagramUrl);
    const media = result?.data?.media;
    if (!result?.success || !media?.length) return null;

    const post: CachedPost = {
      shortCode: cacheId,
      rawUrl: instagramUrl,
      authorUsername: "NOT_SET",
      likes: 0,
      comments: 0,
      width: 720,
      height: 1280,
      media: media
        .filter((m) => m.url)
        .map((m) => ({
          url: m.url!,
          mediaType: m.type === "image" ? "image" : "video",
          thumbnailUrl: m.thumbnail ?? m.url!,
        })),
    };
    if (post.media.length === 0) return null;

    await env.CACHE.put(key, JSON.stringify(post), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
    return post;
  } catch (err) {
    console.error(`snapsave failed for ${instagramUrl}:`, err);
    return null;
  }
}
