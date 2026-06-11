import { Hono } from "hono";
import type { Context } from "hono";
import { getOrFetchPost } from "./posts";
import { renderDocs, renderEmbed } from "./render";
import type { CachedPost, Env } from "./types";
import {
  CHROME_UA,
  SITE_NAME,
  SITE_URL,
  base64UrlDecode,
  isTelegramBot,
  isValidInstagramUsername,
} from "./util";

type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.redirect("https://instagram.com/missuo.me"));

app.get("/docs", (c) => c.html(renderDocs()));

app.get("/oembed", (c) => {
  const q = c.req.query();
  const likesComments = q["likescomments"] ?? "";
  const providerName = `${SITE_NAME}${likesComments ? " " + likesComments : ""}`;

  return c.json({
    version: "1.0",
    type: "video",
    author_name: q["desc"] || q["username"] || SITE_NAME,
    author_url: "https://instagram.com/" + (q["username"] ?? ""),
    provider_name: providerName,
    provider_url: SITE_URL,
    title: "",
  });
});

// ── ActivityPub status (drives Discord's multi-image grid) ─────────────────

async function activity(c: Ctx) {
  const payload = base64UrlDecode(c.req.param("contextBase64") ?? "");
  const parts = payload.split("&");

  const cacheId = parts[0] ?? "";
  const order = parseInt(parts[1] ?? "") || 0;
  const igUrl =
    parts.length > 2
      ? parts.slice(2).join("&") // re-join in case igUrl had & in it
      : `https://instagram.com/p/${cacheId}/`;

  const post = await getOrFetchPost(c.env, cacheId, igUrl);
  if (!post) return c.notFound();

  const host = `https://${new URL(c.req.url).host}`;
  const now = new Date().toISOString();
  const count = post.media.length;

  const mediaAttachments = [...post.media.slice(order), ...post.media.slice(0, order)]
    .slice(0, 4)
    .map((m, i) => {
      const globalIdx = (order + i) % count;
      return {
        id: cacheId,
        type: m.mediaType,
        url: `${host}/offload/${cacheId}?order=${globalIdx}`,
        preview_url: `${host}/offload/${cacheId}?order=${globalIdx}&thumbnail=true`,
        remote_url: null,
        preview_remote_url: null,
        text_url: null,
        description: null,
        meta: {
          width: post.width,
          height: post.height,
          aspect: post.height === 0 ? 0.565 : post.height / post.width,
          size: `${post.width}x${post.height}`,
        },
      };
    });

  const accountUrl = "https://instagram.com/" + post.authorUsername;
  const avatar = post.avatarUrl ?? `${SITE_URL}/favicon.png`;

  return c.json({
    id: c.req.param("contextBase64"),
    url: igUrl,
    uri: igUrl,
    created_at: now,
    edited_at: null,
    content: `<p>${post.caption ?? ""}</p><b>❤️ ${post.likes}&nbsp;&nbsp;&nbsp;💬 ${post.comments}</b>`,
    spoiler_text: "",
    language: "en",
    visibility: "public",
    application: { name: SITE_NAME, website: SITE_URL },
    media_attachments: mediaAttachments,
    account: {
      id: post.authorUsername,
      display_name: post.authorName ?? "",
      username: post.authorUsername,
      acct: post.authorUsername,
      url: accountUrl,
      uri: accountUrl,
      created_at: now,
      locked: false,
      bot: false,
      discoverable: false,
      indexable: false,
      group: false,
      avatar,
      avatar_static: avatar,
      followers_count: 0,
      following_count: 0,
      hide_collections: false,
      noindex: false,
      emojis: [],
      roles: [],
      fields: [],
    },
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
    reblog: null,
  });
}

app.get("/api/v1/statuses/:contextBase64", activity);
app.get("/users/:username/statuses/:contextBase64", activity);

// ── Media offload: redirect to the IG CDN, or stream-proxy for Telegram ────

async function offload(c: Ctx) {
  const stripMp4 = (s: string) => s.replace(/\.mp4$/i, "");
  const id = stripMp4(c.req.param("id") ?? "");
  const orderParam = c.req.param("order");
  const orderPath = orderParam !== undefined ? parseInt(stripMp4(orderParam)) : NaN;
  const orderQuery = parseInt(c.req.query("order") ?? "");
  const idx = Math.max(
    0,
    Number.isFinite(orderPath) ? orderPath : Number.isFinite(orderQuery) ? orderQuery : 0,
  );
  const thumbnail = c.req.query("thumbnail") === "true";

  const post = await getOrFetchPost(c.env, id, `https://instagram.com/p/${id}/`);
  if (!post) return c.notFound();

  const entry = post.media[idx] ?? post.media[post.media.length - 1];
  if (!entry) return c.notFound();

  const targetUrl = thumbnail
    ? entry.mediaType === "video"
      ? (post.defaultThumbnailUrl ?? entry.thumbnailUrl)
      : entry.thumbnailUrl
    : entry.url;
  if (!targetUrl) return c.notFound();

  // Telegram's fetcher won't follow redirects to the IG CDN for inline video
  // playback — stream the bytes through, preserving Range semantics.
  if (isTelegramBot(c.req.header("user-agent")) && entry.mediaType === "video") {
    try {
      const headers: Record<string, string> = { "User-Agent": CHROME_UA };
      const range = c.req.header("range");
      if (range) headers["Range"] = range;

      const upstream = await fetch(targetUrl, { headers });
      if (upstream.ok) {
        const h = new Headers({
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
        });
        for (const name of ["content-length", "content-range"]) {
          const v = upstream.headers.get(name);
          if (v) h.set(name, v);
        }
        return new Response(upstream.body, { status: upstream.status, headers: h });
      }
      console.warn(`Telegram proxy got ${upstream.status} for ${targetUrl}`);
    } catch (err) {
      console.warn(`Telegram proxy failed for ${targetUrl}:`, err);
    }
  }

  return c.redirect(targetUrl);
}

app.get("/offload/:id", offload);
app.get("/offload/:id/:order", offload);

// ── Catch-all: profile redirect or post/reel/story embed ───────────────────

app.get("*", async (c) => {
  const raw = new URL(c.req.url).pathname.replace(/^\/+|\/+$/g, "");
  if (!raw) return c.body("Invalid Instagram path.", 400);

  let segments = raw.split("/").map(decodeURIComponent);

  // A bare single segment is a username → redirect to the IG profile.
  if (segments.length === 1) {
    const username = segments[0].replace(/^@/, "");
    if (isValidInstagramUsername(username))
      return c.redirect(`https://instagram.com/${username}`);
    return c.notFound();
  }

  let orderIndex = 0;
  let orderSpecified = false;

  const last = segments[segments.length - 1];
  if (/^\d+$/.test(last)) {
    orderIndex = Math.max(0, parseInt(last) - 1);
    segments = segments.slice(0, -1);
    orderSpecified = true;
  } else {
    const imgIndex = c.req.query("img_index");
    if (imgIndex !== undefined && /^\d+$/.test(imgIndex)) {
      orderIndex = Math.max(0, parseInt(imgIndex));
      orderSpecified = true;
    }
  }

  const id = segments[segments.length - 1];
  let type = segments.length > 1 ? segments[segments.length - 2] : segments[0];
  let username = segments.length > 2 ? segments[0] : null;

  if (username?.toLowerCase() === "stories") {
    username = type; // the actual username segment
    type = `stories/${username}`;
  } else if (username?.toLowerCase() === "share") {
    type = `share/${type}`;
  }

  const instagramUrl = `https://instagram.com/${type}/${id}/`;

  const isStoriesNoId =
    type.toLowerCase().startsWith("stories/") &&
    id.toLowerCase() === username?.toLowerCase();
  const cacheId = isStoriesNoId ? encodeURIComponent(instagramUrl) : id;

  const post = await getOrFetchPost(c.env, cacheId, instagramUrl);
  if (!post || post.media.length === 0) return c.notFound();

  return c.html(buildResponse(c, post, instagramUrl, cacheId, orderIndex, orderSpecified));
});

function buildResponse(
  c: Ctx,
  post: CachedPost,
  igUrl: string,
  cacheId: string,
  orderIndex: number,
  orderSpecified: boolean,
): string {
  const host = new URL(c.req.url).host;
  const contentUrl = `https://${host}/offload/${encodeURIComponent(cacheId)}/${orderIndex}`;

  const single = post.media.length === 1 || orderSpecified;
  const entry = post.media[orderIndex] ?? post.media[0];

  return renderEmbed({
    host,
    isTelegram: isTelegramBot(c.req.header("user-agent")),
    cacheId,
    order: orderIndex,
    igUrl,
    post,
    files: single ? [entry] : post.media.slice(0, 16),
    isPhoto: single ? entry.mediaType === "image" : true,
    contentUrl,
    thumbnailUrl: single ? entry.thumbnailUrl : null,
  });
}

export default app;
