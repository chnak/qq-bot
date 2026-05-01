/**
 * 获取 Access Token
 */

const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";

// 重试配置
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

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
 * 带重试的 fetch
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  retryDelayMs: number = DEFAULT_RETRY_DELAY_MS,
  log?: Logger,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 判断是否应该重试
      const shouldRetry = attempt < maxRetries && (
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("ETIMEDOUT") ||
        lastError.message.includes("NetworkError") ||
        lastError.message.includes("timeout")
      );

      if (!shouldRetry) {
        throw lastError;
      }

      const delay = retryDelayMs * Math.pow(2, attempt);
      log?.info?.(`[qqbot-sdk] Token fetch failed, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 获取 AccessToken（带缓存 + singleflight 并发安全 + 重试）
 */
export async function getAccessToken(
  appId: string,
  clientSecret: string,
  tokenCache: { token: string; expiresAt: number; appId: string } | null,
  setToken: (t: TokenCache) => void,
  log?: Logger,
  retryOptions: { maxRetries?: number; retryDelayMs?: number } = {},
): Promise<string> {
  const normalizedAppId = String(appId).trim();
  const maxRetries = retryOptions.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = retryOptions.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

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
    response = await fetchWithRetry(
      TOKEN_URL,
      {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      },
      maxRetries,
      retryDelayMs,
      log,
    );
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
