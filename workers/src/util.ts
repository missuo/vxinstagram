export const SITE_NAME = "ins.so";
export const SITE_URL = "https://ins.so";

export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const isTelegramBot = (ua: string | undefined) =>
  (ua ?? "").toLowerCase().includes("telegrambot");

// Instagram usernames: 1-30 chars, letters/digits/period/underscore only.
export const isValidInstagramUsername = (s: string) =>
  s.length > 0 && s.length <= 30 && /^[A-Za-z0-9._]+$/.test(s);

export function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += ["", "", "==", "="][s.length % 4];
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
