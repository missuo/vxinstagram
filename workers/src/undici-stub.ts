// snapsave-media-downloader imports { ProxyAgent } from "undici" at module
// top level but only instantiates it when a proxy option is passed. Bundling
// real undici drags in node:net/tls which Workers can't run, so we alias it
// to this stub (see wrangler.toml [alias]).
export class ProxyAgent {
  constructor(_opts: unknown) {
    throw new Error("HTTP proxies are not supported on Cloudflare Workers");
  }
}

export default { ProxyAgent };
