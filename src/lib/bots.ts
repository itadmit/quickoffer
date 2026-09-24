/**
 * Is this request a link-preview crawler rather than a person?
 *
 * The professional forwards /q/{id} in WhatsApp, and WhatsApp immediately
 * fetches the page to draw the preview card. Counting that as a view sends
 * "הלקוח פתח את ההצעה" before the customer has seen anything, freezes
 * `first_viewed_at` at the moment of forwarding, and starts the §6.6 reminder
 * clock from the wrong instant. The page still renders for them - the preview
 * needs the HTML - we just don't record it.
 *
 * Biased towards calling something a bot: a missed real view costs one
 * notification, a false one costs the professional's trust in the notification.
 */

/** Matched case-insensitively as substrings; these are unambiguous. */
const CRAWLER_TOKENS = [
  "whatsapp",
  "facebookexternalhit",
  "facebookcatalog",
  "facebot",
  "telegrambot",
  "twitterbot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "linkedinbot",
  "skypeuripreview",
  "viber",
  "line-poker",
  "googlebot",
  "google-inspectiontool",
  "google-read-aloud",
  "bingbot",
  "yandexbot",
  "duckduckbot",
  "baiduspider",
  "applebot",
  "petalbot",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "bytespider",
  "gptbot",
  "claudebot",
  "perplexitybot",
  "headlesschrome",
  "chrome-lighthouse",
  "pagespeed",
  "curl/",
  "wget/",
  "python-requests",
  "axios/",
  "go-http-client",
  "node-fetch",
  "okhttp",
  "postman",
];

/**
 * Generic shapes, kept separate because they need a boundary. A bare "bot"
 * substring would flag every Android phone whose model name ends in it
 * (CUBOT), so only the conventional "Name/1.0" and "…bot;" forms count.
 */
const GENERIC = /(?:bot\/|bot;|\bbot\b|crawler|spider|scraper|preview|fetcher|monitoring|uptime)/i;

export function isBot(userAgent: string | null | undefined): boolean {
  // Every real browser sends one. Anything without it is a script.
  if (!userAgent || !userAgent.trim()) return true;
  const ua = userAgent.toLowerCase();
  if (CRAWLER_TOKENS.some((t) => ua.includes(t))) return true;
  return GENERIC.test(ua);
}
