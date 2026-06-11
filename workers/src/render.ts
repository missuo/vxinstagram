import type { CachedMedia, CachedPost } from "./types";
import { SITE_NAME, base64UrlEncode, esc } from "./util";

const BOOTSTRAP =
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />';

export interface EmbedParams {
  host: string;
  isTelegram: boolean;
  cacheId: string;
  order: number;
  igUrl: string;
  post: CachedPost;
  files: CachedMedia[];
  isPhoto: boolean;
  contentUrl: string;
  thumbnailUrl: string | null;
}

export function renderEmbed(p: EmbedParams): string {
  const post = p.post;
  const baseUrl = `https://${p.host}`;

  let contentUrl = p.contentUrl;
  if (!p.isPhoto && !contentUrl.toLowerCase().endsWith(".mp4"))
    contentUrl = contentUrl.replace(/\/+$/, "") + ".mp4";

  let width = post.width > 0 ? post.width : 720;
  let height = post.height > 0 ? post.height : 1280;
  if (width > 1920 || height > 1920) {
    width = Math.floor(width / 2);
    height = Math.floor(height / 2);
  }
  if (width < 400 && height < 400) {
    width *= 2;
    height *= 2;
  }

  // Telegram's preview fetcher only needs a minimal OG document.
  if (p.isTelegram) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta property="og:type" content="video.other" />
    <meta property="og:title" content="${SITE_NAME}" />
    <meta property="og:image" content="${esc(contentUrl)}" />

    <meta property="og:video" content="${esc(contentUrl)}" />
    <meta property="og:video:secure_url" content="${esc(contentUrl)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="720" />
    <meta property="og:video:height" content="1280" />

    <link rel="alternate" type="application/activity+json"
          href="${baseUrl}/users/username/statuses/${base64UrlEncode(`${p.cacheId}&${p.order}&${p.igUrl}`)}" />
</head>
<body>
</body>
</html>`;
  }

  // d.vx → expose caption/author in embed; vx → anonymous
  const showDetails = p.host.toLowerCase().startsWith("d.");
  const caption = showDetails ? (post.caption ?? null) : null;
  const username = showDetails ? post.authorUsername : null;
  const fullName = showDetails ? (post.authorName ?? null) : null;
  const trackName = post.trackName ?? SITE_NAME;

  const oembedDesc = p.isPhoto ? "" : encodeURIComponent(caption ?? "");
  const likesComments =
    showDetails && (post.likes > 0 || post.comments > 0)
      ? ` ❤️ ${post.likes} 💬 ${post.comments}`
      : "";

  const activityContext = base64UrlEncode(`${p.cacheId}&${p.order}&${p.igUrl}`);
  const emitActivityLink = p.files.length > 1;

  const favicon =
    trackName === SITE_NAME
      ? `<link href="/favicon.png" rel="icon" type="image/png" sizes="any">
    <link href="/favicon-32x32.png" rel="icon" type="image/png" sizes="32x32">
    <link href="/favicon-16x16.png" rel="icon" type="image/png" sizes="16x16">`
      : `<link href="/favicon-note.png" rel="icon" type="image/png" sizes="any">
    <link href="/favicon-note-32x32.png" rel="icon" type="image/png" sizes="32x32">`;

  const ogMedia = p.isPhoto
    ? `<meta property="og:image" content="${esc(contentUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${esc(contentUrl)}" />
    ${caption ? `<meta property="og:description" content="${esc(caption)}" />` : ""}`
    : `<meta property="og:type" content="video.other" />
    <meta property="og:video" content="${esc(contentUrl)}" />
    <meta property="og:video:secure_url" content="${esc(contentUrl)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="${width}" />
    <meta property="og:video:height" content="${height}" />
    <meta name="twitter:card" content="player" />
    <meta name="twitter:player:stream" content="${esc(contentUrl)}" />
    <meta name="twitter:player:stream:content_type" content="video/mp4" />
    <meta name="twitter:player:width" content="${width}" />
    <meta name="twitter:player:height" content="${height}" />
    <meta name="twitter:player" content="${esc(p.igUrl)}" />`;

  const titleTags =
    caption !== null && username !== null
      ? `<meta property="og:title" content="${esc(`${fullName} (@${username})`)}" />
    <meta property="og:description" content="${esc(caption)}" />
    <meta property="twitter:title" content="${esc(`${fullName} (@${username})`)}" />
    <meta property="twitter:site" content="${esc(username)}" />
    <meta property="twitter:creator" content="${esc(username)}" />`
      : "";

  const oembedLink = emitActivityLink
    ? `<link rel="alternate" type="application/json+oembed"
          href="${baseUrl}/oembed?username=${encodeURIComponent(username ?? "instagram")}&desc=${oembedDesc}&likescomments=${encodeURIComponent(likesComments)}" />`
    : "";

  // activity+json only for multi-media posts — triggers Discord's image grid
  const activityLink = emitActivityLink
    ? `<link rel="alternate" type="application/activity+json"
          href="${baseUrl}/users/username/statuses/${activityContext}" />`
    : "";

  const cards = p.files
    .map((item) => {
      const media =
        item.mediaType === "video"
          ? `<video class="w-100" style="aspect-ratio:5/6; object-fit:cover;" controls>
                    <source src="${esc(item.url)}" type="video/mp4" />
                    Your browser does not support the video tag.
                </video>`
          : `<img src="${esc(item.url)}" class="w-100" style="aspect-ratio:5/6; object-fit:cover;" alt="Instagram post" />`;
      return `<div class="col-12 col-md-6 col-lg-4">
            <div class="card border-secondary shadow rounded-3 bg-dark text-light overflow-hidden">
                ${media}
                <div class="d-flex flex-column gap-2 p-3">
                    <a class="btn btn-success" href="${esc(item.url)}" download>Download</a>
                    <a class="btn btn-primary" href="${esc(p.igUrl)}" target="_blank">View Original</a>
                </div>
            </div>
        </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${BOOTSTRAP}
    ${favicon}

    ${ogMedia}

    <meta property="og:site_name" content="${esc(trackName)}" />
    <meta property="theme-color" content="#eb4034" />
    <meta property="og:url" content="${esc(p.igUrl)}" />
    <link rel="canonical" href="${esc(p.igUrl)}" />
    ${titleTags}
    ${oembedLink}
    ${activityLink}

    <title>${SITE_NAME}</title>
</head>
<body class="bg-dark text-light">

    <div class="d-flex border-bottom border-secondary p-4 align-items-center justify-content-between shadow">
        <div>
            <div class="text-secondary">
                InstagramEmbed by
                <a href="https://github.com/Lainmode/InstagramEmbedForDiscord" target="_blank">Lainmode</a>
            </div>
        </div>
    </div>

    <div class="row g-4 align-items-start w-100 justify-content-center mx-auto p-4">
        ${cards}
    </div>
</body>
</html>`;
}

export function renderDocs(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ins.so(1) — fix instagram embeds</title>
<meta name="description" content="ins.so — fix Instagram embeds on Discord, Telegram and anything that speaks Open Graph." />
<link href="/favicon.png" rel="icon" type="image/png" sizes="any">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0b">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#faf9f6">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,600;0,800;1,400&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0a0b;
    --panel: #111113;
    --line: #232328;
    --txt: #d6d6d3;
    --dim: #76767e;
    --faint: #4a4a52;
    --scan: rgba(255,255,255,.012);
    --ig: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    --accent: #e6683c;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #faf9f6;
      --panel: #ffffff;
      --line: #e6e3dc;
      --txt: #26262b;
      --dim: #6d6d76;
      --faint: #9b9ba3;
      --scan: rgba(0,0,0,.014);
      --accent: #cc2366;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { background: var(--bg); color-scheme: dark light; }
  body {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    color: var(--txt);
    font-size: 14px;
    line-height: 1.7;
    min-height: 100vh;
    background:
      repeating-linear-gradient(0deg, transparent 0 2px, var(--scan) 2px 4px),
      var(--bg);
  }
  main { max-width: 760px; margin: 0 auto; padding: 4rem 1.5rem 6rem; }

  /* staggered load-in */
  section, header.man, footer.man {
    opacity: 0; transform: translateY(8px);
    animation: rise .5s cubic-bezier(.2,.7,.3,1) forwards;
  }
  header.man { animation-delay: .05s }
  section:nth-of-type(1) { animation-delay: .15s }
  section:nth-of-type(2) { animation-delay: .25s }
  section:nth-of-type(3) { animation-delay: .35s }
  section:nth-of-type(4) { animation-delay: .45s }
  section:nth-of-type(5) { animation-delay: .55s }
  footer.man { animation-delay: .65s }
  @keyframes rise { to { opacity: 1; transform: none } }
  @media (prefers-reduced-motion: reduce) {
    section, header.man, footer.man { animation: none; opacity: 1; transform: none }
  }

  header.man {
    display: flex; justify-content: space-between; align-items: baseline;
    color: var(--dim); font-size: 12px; letter-spacing: .08em;
    border-bottom: 1px solid var(--line); padding-bottom: 1rem; margin-bottom: 3rem;
  }
  .wordmark {
    font-size: clamp(2.6rem, 9vw, 4.5rem);
    font-weight: 800; letter-spacing: -.04em; line-height: 1.1;
    margin: 0 0 .5rem;
  }
  .wordmark .ins {
    background: var(--ig);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
  }
  .tagline { color: var(--dim); margin-bottom: 4rem; }
  .tagline b { color: var(--txt); font-weight: 600 }

  h2 {
    font-size: 12px; font-weight: 800; letter-spacing: .25em;
    text-transform: uppercase; color: var(--faint);
    margin: 3.5rem 0 1.2rem;
  }
  h2::before { content: "§ "; color: var(--accent); }

  .swap {
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 6px; padding: 1.4rem 1.5rem; overflow-x: auto;
  }
  .swap .from { color: var(--dim); text-decoration: line-through; text-decoration-color: #dc274388; }
  .swap .arrow { color: var(--faint); margin: .2rem 0; }
  .swap .to b {
    background: var(--ig);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    font-weight: 800;
  }
  .swap .comment { color: var(--faint); }

  table { width: 100%; border-collapse: collapse; }
  td {
    padding: .65rem .8rem; border-top: 1px solid var(--line);
    vertical-align: top; font-size: 13.5px;
  }
  tr:last-child td { border-bottom: 1px solid var(--line); }
  tr { transition: background .15s; }
  tbody tr:hover { background: rgba(230,104,60,.05); }
  td.r { white-space: nowrap; color: var(--txt); font-weight: 600; }
  td.r .v { color: var(--accent); font-style: italic; font-weight: 400; }
  td.d { color: var(--dim); }

  .note { border-left: 2px solid var(--accent); padding: .2rem 0 .2rem 1.2rem; color: var(--dim); margin: .9rem 0; }
  .note b, .note code { color: var(--txt); font-weight: 600; font-family: inherit; }

  footer.man {
    margin-top: 5rem; padding-top: 1rem; border-top: 1px solid var(--line);
    color: var(--faint); font-size: 12px;
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: .5rem;
  }
  a { color: var(--dim); text-underline-offset: 3px; }
  a:hover { color: var(--accent); }
  ::selection { background: #cc2366; color: #fff; }
</style>
</head>
<body>
<main>
  <header class="man"><span>INS.SO(1)</span><span>User Commands</span><span>INS.SO(1)</span></header>

  <h1 class="wordmark"><span class="ins">ins</span>.so</h1>
  <p class="tagline">Fix Instagram embeds on <b>Discord</b>, <b>Telegram</b>, and anything that speaks Open Graph.</p>

  <section>
    <h2>Synopsis</h2>
    <div class="swap">
      <div class="from">https://www.instagram.com/reel/DAbCdEfGhIj/</div>
      <div class="arrow">↓ &nbsp;<span class="comment"># swap the domain — that's it</span></div>
      <div class="to">https://<b>ins.so</b>/reel/DAbCdEfGhIj/</div>
    </div>
  </section>

  <section>
    <h2>Routes</h2>
    <table>
      <tbody>
        <tr><td class="r">/p/<span class="v">id</span></td><td class="d">post — photo, video, or whole album</td></tr>
        <tr><td class="r">/reel/<span class="v">id</span></td><td class="d">reel (also /reels/)</td></tr>
        <tr><td class="r">/stories/<span class="v">user</span>/<span class="v">id</span></td><td class="d">story</td></tr>
        <tr><td class="r">/share/<span class="v">…</span></td><td class="d">share links from the app</td></tr>
        <tr><td class="r">/<span class="v">user</span>/p/<span class="v">id</span></td><td class="d">post via profile-style URL</td></tr>
        <tr><td class="r">/p/<span class="v">id</span>/<span class="v">N</span></td><td class="d">N-th item of an album (1-based)</td></tr>
        <tr><td class="r">/<span class="v">username</span></td><td class="d">redirect to the Instagram profile (@ prefix ok)</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>Albums</h2>
    <div class="swap">
      <div><span class="comment"># whole album → image grid</span></div>
      <div>https://<b style="font-weight:800">ins.so</b>/p/DAbCdEfGhIj/</div>
      <div class="arrow">&nbsp;</div>
      <div><span class="comment"># second item only — append the index</span></div>
      <div>https://ins.so/p/DAbCdEfGhIj/<span style="color:var(--accent);font-weight:800">2</span>/</div>
    </div>
  </section>

  <section>
    <h2>Notes</h2>
    <div class="note">Only <b>public</b> posts can be embedded. Private accounts and age-gated media won't resolve.</div>
    <div class="note">Telegram caches previews aggressively — send your link to <code>@WebpageBot</code> to force a refresh.</div>
    <div class="note">Opening a link in a browser shows a preview page with download buttons; bots get the Open Graph card.</div>
  </section>

  <footer class="man">
    <span>built on <a href="https://github.com/Lainmode/InstagramEmbed-vxinstagram" target="_blank">InstagramEmbed</a> by Lainmode</span>
    <span><a href="https://github.com/missuo/vxinstagram" target="_blank">source</a></span>
  </footer>
</main>
</body>
</html>`;
}
