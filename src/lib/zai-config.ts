import fs from "node:fs";
import path from "node:path";

/**
 * Ensures `.z-ai-config` exists in the project root, populated from
 * environment variables. The z-ai-web-dev-sdk reads config from:
 *   1. process.cwd()/.z-ai-config
 *   2. ~/.z-ai-config
 *   3. /etc/.z-ai-config
 *
 * On the Z.ai sandbox, /etc/.z-ai-config already exists with the correct
 * values. On Vercel (or any other host), the user must set these env vars:
 *   - ZAI_BASE_URL    e.g. https://api.z.ai/v1
 *   - ZAI_API_KEY     your API key
 *   - ZAI_CHAT_ID     (optional)
 *   - ZAI_USER_ID     (optional)
 *   - ZAI_TOKEN       (optional)
 *
 * This helper writes them to <cwd>/.z-ai-config so the SDK can find them.
 *
 * It is safe to call multiple times — if the file already exists with the
 * same content, it does nothing.
 */
let initialized = false;

export function ensureZaiConfig(): void {
  if (initialized) return;

  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  // If env vars are set, write the config file (overrides any existing one).
  if (baseUrl && apiKey) {
    const configPath = path.join(process.cwd(), ".z-ai-config");
    const config = {
      baseUrl,
      apiKey,
      chatId: process.env.ZAI_CHAT_ID ?? "",
      userId: process.env.ZAI_USER_ID ?? "",
      token: process.env.ZAI_TOKEN ?? "",
    };
    try {
      fs.writeFileSync(configPath, JSON.stringify(config), {
        encoding: "utf-8",
      });
      console.log("[zai-config] Wrote .z-ai-config from env vars");
    } catch (err) {
      console.error("[zai-config] Failed to write config:", err);
    }
  } else {
    // No env vars — rely on /etc/.z-ai-config or ~/.z-ai-config
    // (sandbox case)
    console.log("[zai-config] No ZAI_BASE_URL/ZAI_API_KEY env vars; relying on existing config file");
  }

  initialized = true;
}
