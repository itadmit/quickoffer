// Point app_settings at the local mock server (tests/mock-server.mjs).
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { setSetting } from "@/lib/settings";

async function main() {
  await setSetting("ibot.base_url", "http://localhost:4001/api/v1/");
  await setSetting("ibot.token", "mock-token");
  await setSetting("ibot.instance_id", "mock-instance");
  await setSetting("ibot.webhook_token", "hook-secret");
  await setSetting("llm.provider", "custom");
  await setSetting("llm.base_url", "http://localhost:4001/v1");
  await setSetting("llm.model", "mock-llm");
  await setSetting("llm.api_key", "mock-key");
  await setSetting("app.url", "http://localhost:3000");
  await setSetting("telegram.webhook_secret", "tg-secret");
  console.log("seeded app_settings for local mock");
  process.exit(0);
}
main();
