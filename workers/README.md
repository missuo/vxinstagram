# vxinstagram on Cloudflare Workers

Hono + TypeScript rewrite of the C# (ASP.NET) app in `../InstagramEmbedForDiscord`.
[`snapsave-media-downloader`](https://github.com/ahmedrangel/snapsave-media-downloader)
runs in-process (it is eval-free and uses only edge-safe APIs), so there is no
Node sidecar — the whole service is one Worker.

## What's ported

- Post / Reel / Story / Album / Share embeds with full Open Graph + Twitter card tags
- Telegram support: UA-detected minimal OG page + Range-aware video stream proxy
- Discord multi-image grid via the ActivityPub status endpoint (`/users/.../statuses/...`)
- oEmbed endpoint
- `/{username}` → 302 to the Instagram profile (`@` prefix allowed)
- 4-hour post cache (Workers KV instead of in-memory cache)

The upstream donation banner / Buy Me a Coffee integration was removed.

## Deploy

```bash
npm install

# 1. Create the KV namespace and paste its id into wrangler.toml
npx wrangler kv namespace create CACHE

# 2. Ship it
npx wrangler deploy
```

Then attach your domain (e.g. `ins.so`) as a Custom Domain on the Worker.
For the `d.`-prefixed details variant, add `d.yourdomain` as a second custom domain.

## Develop

```bash
npm run dev     # local server with simulated KV
npm run check   # tsc + wrangler dry-run bundle
```

## Notes

- Telegram caches link previews aggressively — send a link to `@WebpageBot` to force a refresh.
- `wrangler.toml` aliases `undici` to a stub: snapsave only needs it for optional
  proxy support, and real undici cannot bundle for Workers.
- Bundle size is ~190 KiB gzipped, comfortably inside the free-plan limit.
