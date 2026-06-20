/**
 * Z.AI API client — works in two deployment contexts:
 *
 * 1. **Z.ai sandbox**: Uses /etc/.z-ai-config (auto-injected by Z.ai sandbox).
 *    Endpoint: https://internal-api.z.ai/v1
 *    Auth: JWT token + chat/user IDs (session-bound, sandbox-only).
 *
 * 2. **Public deployment (Vercel, Netlify, self-hosted, etc.)**: Uses
 *    ZAI_PUBLIC_BASE_URL + ZAI_PUBLIC_API_KEY env vars.
 *    Endpoint: https://api.z.ai/api/paas/v4
 *    Auth: Authorization: Bearer <your-z-ai-public-api-key>
 *
 * Get your public API key at https://z.ai/ → API Keys.
 *
 * Priority: env vars > /etc/.z-ai-config.
 *
 * Optional env vars:
 *   ZAI_PUBLIC_BASE_URL  default: https://api.z.ai/api/paas/v4
 *   ZAI_PUBLIC_API_KEY   REQUIRED for non-sandbox deployments
 */

export interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  chatId: string;
  userId: string;
  token: string;
  /** True if loaded from sandbox config, false if from public env vars. */
  isSandbox: boolean;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Load Z.AI config. Priority:
 *   1. Public env vars (ZAI_PUBLIC_API_KEY + ZAI_PUBLIC_BASE_URL)
 *   2. Sandbox file: /etc/.z-ai-config
 *   3. Home dir file: ~/.z-ai-config
 *   4. Cwd file: ./.z-ai-config
 *
 * Returns null if no valid config is found.
 */
export async function loadZaiConfig(): Promise<ZaiConfig | null> {
  // 1) Public env vars — highest priority, works on Vercel/any host.
  if (process.env.ZAI_PUBLIC_API_KEY) {
    const baseUrl = normalizeBaseUrl(
      process.env.ZAI_PUBLIC_BASE_URL || "https://api.z.ai/api/paas/v4"
    );
    return {
      baseUrl,
      apiKey: process.env.ZAI_PUBLIC_API_KEY,
      chatId: process.env.ZAI_PUBLIC_CHAT_ID ?? "",
      userId: process.env.ZAI_PUBLIC_USER_ID ?? "",
      token: "", // public API doesn't use the sandbox JWT
      isSandbox: false,
    };
  }

  // Legacy env var names (kept for backward compatibility with earlier
  // commits — if the user already set ZAI_BASE_URL/ZAI_API_KEY pointing
  // at api.z.ai, those still work).
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    return {
      baseUrl: normalizeBaseUrl(process.env.ZAI_BASE_URL),
      apiKey: process.env.ZAI_API_KEY,
      chatId: process.env.ZAI_CHAT_ID ?? "",
      userId: process.env.ZAI_USER_ID ?? "",
      token: process.env.ZAI_TOKEN ?? "",
      isSandbox: false,
    };
  }

  // 2-4) Sandbox / home / cwd config files
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const candidatePaths = [
    "/etc/.z-ai-config",
    path.join(os.homedir(), ".z-ai-config"),
    path.join(process.cwd(), ".z-ai-config"),
  ];
  for (const filePath of candidatePaths) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const cfg = JSON.parse(raw);
      if (cfg.baseUrl && cfg.apiKey) {
        return {
          baseUrl: normalizeBaseUrl(cfg.baseUrl),
          apiKey: cfg.apiKey,
          chatId: cfg.chatId ?? "",
          userId: cfg.userId ?? "",
          token: cfg.token ?? "",
          isSandbox: true,
        };
      }
    } catch {
      /* file doesn't exist or invalid — try next */
    }
  }

  return null;
}

/**
 * Call the Z.AI image edit API.
 *
 * Endpoint differs by context:
 *   - Sandbox: POST {baseUrl}/images/generations/edit
 *   - Public:  POST {baseUrl}/images/generations/edit
 *              (where baseUrl = https://api.z.ai/api/paas/v4)
 *
 * Body shape is the same in both cases:
 *   { prompt, images: [{ url }], size }
 *
 * Response shape is the same:
 *   { data: [{ base64 | url }] }
 */
export async function callZaiImageEdit(
  config: ZaiConfig,
  body: { prompt: string; image: string; size: string }
): Promise<{ base64?: string; raw: unknown }> {
  const url = `${config.baseUrl}/images/generations/edit`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    "X-Z-AI-From": "Z",
  };
  // Sandbox uses additional headers (X-Chat-Id / X-User-Id / X-Token);
  // public API only needs Authorization Bearer. Sending the extra headers
  // is harmless on public API — they're ignored.
  if (config.chatId) headers["X-Chat-Id"] = config.chatId;
  if (config.userId) headers["X-User-Id"] = config.userId;
  if (config.token) headers["X-Token"] = config.token;

  const requestBody = {
    prompt: body.prompt,
    images: [{ url: body.image }],
    size: body.size,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z.AI API ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const result = await response.json();

  // Z.AI may return base64 directly, or a URL we need to download
  if (result?.data?.[0]?.base64) {
    return { base64: result.data[0].base64 as string, raw: result };
  }

  if (result?.data?.[0]?.url) {
    const imgUrl = result.data[0].url as string;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to download generated image: ${imgRes.status}`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { base64, raw: result };
  }

  return { raw: result };
}
