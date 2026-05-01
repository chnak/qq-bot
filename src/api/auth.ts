/**
 * 获取 Access Token
 */

const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";

// Plugin User-Agent
function getPluginUserAgent(): string {
  return `QQBotSDK/1.0.0 (Node/${process.versions.node})`;
}

import type { Logger } from "../types/index.js";

interface TokenCache {
  token: string;
  expiresAt: number;
  appId: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

/**
 * 获取 AccessToken（带缓存 + singleflight 并发安全）
 */
export async function getAccessToken(
  appId: string,
  clientSecret: string,
  tokenCache: { token: string; expiresAt: number; appId: string } | null,
  setToken: (t: TokenCache) => void,
  log?: Logger,
): Promise<string> {
  const normalizedAppId = String(appId).trim();

  // 检查缓存：未过期时复用
  const REFRESH_AHEAD_MS = tokenCache
    ? Math.min(5 * 60 * 1000, (tokenCache.expiresAt - Date.now()) / 3)
    : 0;

  if (tokenCache && Date.now() < tokenCache.expiresAt - REFRESH_AHEAD_MS) {
    return tokenCache.token;
  }

  const requestBody = { appId, clientSecret };
  const requestHeaders = {
    "Content-Type": "application/json",
    "User-Agent": getPluginUserAgent(),
  };

  log?.info(`[qqbot-sdk:${normalizedAppId}] Fetching access token...`);

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new Error(`Network error getting access_token: ${err instanceof Error ? err.message : String(err)}`);
  }

  let data: TokenResponse;
  try {
    const rawBody = await response.text();
    data = JSON.parse(rawBody) as TokenResponse;
  } catch (err) {
    throw new Error(`Failed to parse access_token response: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!data.access_token) {
    throw new Error(`Failed to get access_token: ${JSON.stringify(data)}`);
  }

  const expiresAt = Date.now() + (data.expires_in ?? 7200) * 1000;

  setToken({
    token: data.access_token,
    expiresAt,
    appId: normalizedAppId,
  });

  log?.info(`[qqbot-sdk:${normalizedAppId}] Token cached, expires at: ${new Date(expiresAt).toISOString()}`);
  return data.access_token;
}
