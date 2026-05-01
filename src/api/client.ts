/**
 * API 客户端
 */

import type { Logger, InlineKeyboard } from "../types/index.js";
import { getAccessToken as fetchAccessToken } from "./auth.js";
import type { StreamMessageRequest, MessageResponse } from "../types/index.js";
import { MediaFileType } from "../types/index.js";
import * as crypto from "node:crypto";
import { computeFileHashes, readFileChunk, runWithConcurrency, putToPresignedUrl, getFileSize } from "../utils/file-hash.js";

const API_BASE = "https://api.sgroup.qq.com";

// 重试配置
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

// Plugin User-Agent
function getPluginUserAgent(): string {
  return `QQBotSDK/1.0.0 (Node/${process.versions.node})`;
}

/**
 * 带重试的请求
 */
async function requestWithRetry<T>(
  requestFn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    retryCondition?: (err: Error) => boolean;
    log?: Logger;
    path?: string;
  } = {},
): Promise<T> {
  const { maxRetries = DEFAULT_MAX_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS, retryCondition, log, path } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 判断是否应该重试
      const shouldRetry = attempt < maxRetries && (
        // 网络错误
        lastError.message.includes("Network error") ||
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("timeout") ||
        // 服务器错误
        lastError.message.includes("HTTP 5") ||
        lastError.message.includes("HTTP 502") ||
        lastError.message.includes("HTTP 503") ||
        lastError.message.includes("HTTP 504") ||
        // 自定义条件
        (retryCondition && retryCondition(lastError))
      );

      if (!shouldRetry) {
        throw lastError;
      }

      // 计算延迟时间（指数退避）
      const delay = retryDelayMs * Math.pow(2, attempt);
      log?.info?.(`[qqbot-sdk] 请求失败，${delay}ms 后重试 (${attempt + 1}/${maxRetries}): ${path ?? lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 重试配置
 */
export interface RetryOptions {
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 初始重试延迟（ms，默认 1000） */
  retryDelayMs?: number;
  /** 是否启用重试（默认 true） */
  enabled?: boolean;
}

// Token 缓存状态
interface TokenCache {
  token: string;
  expiresAt: number;
  appId: string;
}

/**
 * 分片上传进度回调
 */
interface ChunkedUploadProgress {
  completedParts: number;
  totalParts: number;
  uploadedBytes: number;
  totalBytes: number;
}

/**
 * API 客户端
 */
export class QQBotAPIClient {
  private appId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenCache: TokenCache | null = null;
  private log?: Logger;
  private markdownSupport: boolean;
  private retryOptions: Required<RetryOptions>;

  constructor(options: {
    appId: string;
    clientSecret?: string;
    accessToken?: string;
    markdownSupport?: boolean;
    log?: Logger;
    retry?: RetryOptions;
  }) {
    this.appId = options.appId;
    this.clientSecret = options.clientSecret ?? "";
    this.accessToken = options.accessToken ?? null;
    this.markdownSupport = options.markdownSupport ?? false;
    this.log = options.log;
    this.retryOptions = {
      maxRetries: options.retry?.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelayMs: options.retry?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      enabled: options.retry?.enabled ?? true,
    };
  }

  /**
   * 获取当前 access token
   */
  async getToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    if (!this.clientSecret) {
      throw new Error("clientSecret is required when accessToken is not provided");
    }

    return fetchAccessToken(
      this.appId,
      this.clientSecret,
      this.tokenCache,
      (cache) => {
        this.tokenCache = cache;
      },
      this.log,
      { maxRetries: this.retryOptions.maxRetries, retryDelayMs: this.retryOptions.retryDelayMs },
    );
  }

  /**
   * 获取网关 URL
   */
  async getGatewayUrl(): Promise<string> {
    const token = await this.getToken();
    const data = await this.request<{ url: string }>(token, "GET", "/gateway");
    return data.url;
  }

  /**
   * API 请求封装（带重试机制）
   */
  async request<T = unknown>(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    const { maxRetries, retryDelayMs, enabled } = this.retryOptions;
    if (!enabled) {
      return this.doRequest(accessToken, method, path, body, timeoutMs);
    }
    return requestWithRetry(
      () => this.doRequest(accessToken, method, path, body, timeoutMs),
      { maxRetries, retryDelayMs, log: this.log, path },
    );
  }

  /**
   * 实际执行 HTTP 请求
   */
  private async doRequest<T = unknown>(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    const url = `${API_BASE}${path}`;
    const DEFAULT_TIMEOUT = 30000;
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT;

    const headers: Record<string, string> = {
      Authorization: `QQBot ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": getPluginUserAgent(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const options: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(url, options);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request timeout[${path}]: exceeded ${timeout}ms`);
      }
      throw new Error(`Network error [${path}]: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      let errorMsg = `API Error [${path}] HTTP ${res.status}`;
      try {
        const error = JSON.parse(await res.text()) as { message?: string };
        if (error.message) {
          errorMsg = `API Error [${path}]: ${error.message}`;
        }
      } catch {
        // ignore parse error
      }
      throw new Error(errorMsg);
    }

    try {
      return JSON.parse(await res.text()) as T;
    } catch {
      throw new Error(`Failed to parse response [${path}]`);
    }
  }

  /**
   * 内部方法：获取下一个消息序号
   */
  getNextMsgSeq(_msgId: string): number {
    const timePart = Date.now() % 100000000;
    const random = Math.floor(Math.random() * 65536);
    return (timePart ^ random) % 65536;
  }

  /**
   * 构建消息体
   */
  buildMessageBody(
    content: string,
    msgId: string | undefined,
    msgSeq: number,
  ): Record<string, unknown> {
    if (this.markdownSupport) {
      return {
        markdown: { content },
        msg_type: 2,
        msg_seq: msgSeq,
        ...(msgId ? { msg_id: msgId } : {}),
      };
    }
    return {
      content,
      msg_type: 0,
      msg_seq: msgSeq,
      ...(msgId ? { msg_id: msgId } : {}),
    };
  }

  // ── 消息发送 API ──

  /**
   * 发送 C2C 消息
   */
  async sendC2CMessage(
    openid: string,
    content: string,
    msgId?: string,
  ): Promise<MessageResponse> {
    const token = await this.getToken();
    const msgSeq = msgId ? this.getNextMsgSeq(msgId) : 1;
    const body = this.buildMessageBody(content, msgId, msgSeq);
    return this.request<MessageResponse>(token, "POST", `/v2/users/${openid}/messages`, body);
  }

  /**
   * 发送正在输入状态提示（仅 C2C 私聊有效）
   * @param openid 用户 openid
   * @param msgId 可选，关联的消息 ID
   * @param inputSecond 保持输入状态的秒数（默认 60）
   */
  async sendC2CInputNotify(
    openid: string,
    msgId?: string,
    inputSecond: number = 60,
  ): Promise<void> {
    const token = await this.getToken();
    const msgSeq = msgId ? this.getNextMsgSeq(msgId) : 1;
    const body: Record<string, unknown> = {
      msg_type: 6,
      input_notify: {
        input_type: 1,
        input_second: inputSecond,
      },
      msg_seq: msgSeq,
    };
    if (msgId) body.msg_id = msgId;
    await this.request(token, "POST", `/v2/users/${openid}/messages`, body);
  }

  /**
   * 发送带 Inline Keyboard 的 C2C 消息（按钮点击触发 INTERACTION_CREATE 事件）
   */
  async sendC2CMessageWithInlineKeyboard(
    openid: string,
    content: string,
    inlineKeyboard: InlineKeyboard,
    msgId?: string,
  ): Promise<MessageResponse> {
    const token = await this.getToken();
    const msgSeq = msgId ? this.getNextMsgSeq(msgId) : 1;
    const body = this.buildMessageBody(content, msgId, msgSeq);
    body.keyboard = inlineKeyboard;
    return this.request<MessageResponse>(token, "POST", `/v2/users/${openid}/messages`, body);
  }

  /**
   * 发送群聊消息
   */
  async sendGroupMessage(
    groupOpenid: string,
    content: string,
    msgId?: string,
  ): Promise<MessageResponse> {
    const token = await this.getToken();
    const msgSeq = msgId ? this.getNextMsgSeq(msgId) : 1;
    const body = this.buildMessageBody(content, msgId, msgSeq);
    return this.request<MessageResponse>(token, "POST", `/v2/groups/${groupOpenid}/messages`, body);
  }

  /**
   * 发送频道消息
   */
  async sendChannelMessage(
    channelId: string,
    content: string,
    msgId?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const token = await this.getToken();
    return this.request(token, "POST", `/channels/${channelId}/messages`, {
      content,
      ...(msgId ? { msg_id: msgId } : {}),
    });
  }

  /**
   * 发送频道私信消息
   */
  async sendDmMessage(
    guildId: string,
    content: string,
    msgId?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const token = await this.getToken();
    return this.request(token, "POST", `/dms/${guildId}/messages`, {
      content,
      ...(msgId ? { msg_id: msgId } : {}),
    });
  }

  /**
   * 回应按钮交互
   */
  async acknowledgeInteraction(
    interactionId: string,
    code: 0 | 1 | 2 | 3 | 4 | 5 = 0,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const token = await this.getToken();
    await this.request(token, "PUT", `/interactions/${interactionId}`, { code, ...(data ? { data } : {}) });
  }

  // ── 流式消息 API ──

  /**
   * 发送 C2C 流式消息
   */
  async sendC2CStreamMessage(
    openid: string,
    req: StreamMessageRequest,
  ): Promise<MessageResponse> {
    const token = await this.getToken();
    const body: Record<string, unknown> = {
      input_mode: req.input_mode,
      input_state: req.input_state,
      content_type: req.content_type,
      content_raw: req.content_raw,
      event_id: req.event_id,
      msg_id: req.msg_id,
      msg_seq: req.msg_seq,
      index: req.index,
    };
    if (req.stream_msg_id) {
      body.stream_msg_id = req.stream_msg_id;
    }
    return this.request<MessageResponse>(token, "POST", `/v2/users/${openid}/stream_messages`, body);
  }

  // ── 富媒体消息 API ──

  /**
   * 上传 C2C 媒体文件
   */
  async uploadC2CMedia(
    openid: string,
    fileType: number,
    url?: string,
    fileData?: string,
  ): Promise<{ file_uuid: string; file_info: string; ttl: number }> {
    const token = await this.getToken();
    const body: Record<string, unknown> = { file_type: fileType };
    if (url) body.url = url;
    else if (fileData) body.file_data = fileData;

    return this.request(token, "POST", `/v2/users/${openid}/files`, body);
  }

  /**
   * 上传群聊媒体文件
   */
  async uploadGroupMedia(
    groupOpenid: string,
    fileType: number,
    url?: string,
    fileData?: string,
  ): Promise<{ file_uuid: string; file_info: string; ttl: number }> {
    const token = await this.getToken();
    const body: Record<string, unknown> = { file_type: fileType };
    if (url) body.url = url;
    else if (fileData) body.file_data = fileData;

    return this.request(token, "POST", `/v2/groups/${groupOpenid}/files`, body);
  }

  /**
   * 发送 C2C 媒体消息
   */
  async sendC2CMediaMessage(
    openid: string,
    fileInfo: string,
    msgId?: string,
    content?: string,
  ): Promise<MessageResponse> {
    const token = await this.getToken();
    const msgSeq = msgId ? this.getNextMsgSeq(msgId) : 1;
    return this.request<MessageResponse>(token, "POST", `/v2/users/${openid}/messages`, {
      msg_type: 7,
      media: { file_info: fileInfo },
      msg_seq: msgSeq,
      ...(content ? { content } : {}),
      ...(msgId ? { msg_id: msgId } : {}),
    });
  }

  /**
   * 发送群聊媒体消息
   */
  async sendGroupMediaMessage(
    groupOpenid: string,
    fileInfo: string,
    msgId?: string,
    content?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const token = await this.getToken();
    const msgSeq = msgId ? this.getNextMsgSeq(msgId) : 1;
    return this.request(token, "POST", `/v2/groups/${groupOpenid}/messages`, {
      msg_type: 7,
      media: { file_info: fileInfo },
      msg_seq: msgSeq,
      ...(content ? { content } : {}),
      ...(msgId ? { msg_id: msgId } : {}),
    });
  }

  /**
   * 发送 C2C 图片消息
   */
  async sendC2CImageMessage(
    openid: string,
    imageUrl: string,
    msgId?: string,
    content?: string,
  ): Promise<MessageResponse> {
    const isBase64 = imageUrl.startsWith("data:");
    let uploadResult: { file_uuid: string; file_info: string; ttl: number };

    if (isBase64) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid Base64 Data URL format");
      uploadResult = await this.uploadC2CMedia(openid, 1, undefined, matches[2]);
    } else {
      uploadResult = await this.uploadC2CMedia(openid, 1, imageUrl);
    }

    return this.sendC2CMediaMessage(openid, uploadResult.file_info, msgId, content);
  }

  /**
   * 发送群聊图片消息
   */
  async sendGroupImageMessage(
    groupOpenid: string,
    imageUrl: string,
    msgId?: string,
    content?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const isBase64 = imageUrl.startsWith("data:");
    let uploadResult: { file_uuid: string; file_info: string; ttl: number };

    if (isBase64) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid Base64 Data URL format");
      uploadResult = await this.uploadGroupMedia(groupOpenid, 1, undefined, matches[2]);
    } else {
      uploadResult = await this.uploadGroupMedia(groupOpenid, 1, imageUrl);
    }

    return this.sendGroupMediaMessage(groupOpenid, uploadResult.file_info, msgId, content);
  }

  /**
   * 发送 C2C 语音消息
   */
  async sendC2CVoiceMessage(
    openid: string,
    voiceUrl?: string,
    voiceBase64?: string,
    msgId?: string,
  ): Promise<MessageResponse> {
    const uploadResult = await this.uploadC2CMedia(openid, 3, voiceUrl, voiceBase64);
    return this.sendC2CMediaMessage(openid, uploadResult.file_info, msgId);
  }

  /**
   * 发送群聊语音消息
   */
  async sendGroupVoiceMessage(
    groupOpenid: string,
    voiceUrl?: string,
    voiceBase64?: string,
    msgId?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const uploadResult = await this.uploadGroupMedia(groupOpenid, 3, voiceUrl, voiceBase64);
    return this.sendGroupMediaMessage(groupOpenid, uploadResult.file_info, msgId);
  }

  // ── 分片上传 API ──

  /**
   * 申请上传（C2C）
   */
  private async uploadPrepareC2C(
    openid: string,
    fileType: MediaFileType,
    fileName: string,
    fileSize: number,
    hashes: { md5: string; sha1: string; md5_10m: string },
  ): Promise<{ upload_id: string; block_size: number; parts: Array<{ index: number; presigned_url: string }>; concurrency?: number; retry_timeout?: number }> {
    const token = await this.getToken();
    return this.request(token, "POST", `/v2/users/${openid}/upload_prepare`, {
      file_type: fileType,
      file_name: fileName,
      file_size: fileSize,
      md5: hashes.md5,
      sha1: hashes.sha1,
      md5_10m: hashes.md5_10m,
    });
  }

  /**
   * 完成分片上传（C2C）
   */
  private async uploadPartFinishC2C(
    openid: string,
    uploadId: string,
    partIndex: number,
    blockSize: number,
    md5: string,
  ): Promise<void> {
    const token = await this.getToken();
    await this.request(token, "POST", `/v2/users/${openid}/upload_part_finish`, {
      upload_id: uploadId,
      part_index: partIndex,
      block_size: blockSize,
      md5,
    });
  }

  /**
   * 完成文件上传（C2C）
   */
  private async completeUploadC2C(
    openid: string,
    uploadId: string,
  ): Promise<{ file_uuid: string; file_info: string; ttl: number }> {
    const token = await this.getToken();
    return this.request(token, "POST", `/v2/users/${openid}/files`, {
      upload_id: uploadId,
    });
  }

  /**
   * 申请上传（Group）
   */
  private async uploadPrepareGroup(
    groupOpenid: string,
    fileType: MediaFileType,
    fileName: string,
    fileSize: number,
    hashes: { md5: string; sha1: string; md5_10m: string },
  ): Promise<{ upload_id: string; block_size: number; parts: Array<{ index: number; presigned_url: string }>; concurrency?: number; retry_timeout?: number }> {
    const token = await this.getToken();
    return this.request(token, "POST", `/v2/groups/${groupOpenid}/upload_prepare`, {
      file_type: fileType,
      file_name: fileName,
      file_size: fileSize,
      md5: hashes.md5,
      sha1: hashes.sha1,
      md5_10m: hashes.md5_10m,
    });
  }

  /**
   * 完成分片上传（Group）
   */
  private async uploadPartFinishGroup(
    groupOpenid: string,
    uploadId: string,
    partIndex: number,
    blockSize: number,
    md5: string,
  ): Promise<void> {
    const token = await this.getToken();
    await this.request(token, "POST", `/v2/groups/${groupOpenid}/upload_part_finish`, {
      upload_id: uploadId,
      part_index: partIndex,
      block_size: blockSize,
      md5,
    });
  }

  /**
   * 完成文件上传（Group）
   */
  private async completeUploadGroup(
    groupOpenid: string,
    uploadId: string,
  ): Promise<{ file_uuid: string; file_info: string; ttl: number }> {
    const token = await this.getToken();
    return this.request(token, "POST", `/v2/groups/${groupOpenid}/files`, {
      upload_id: uploadId,
    });
  }

  // ── 本地文件分片上传 ──

  /**
   * C2C 本地文件分片上传
   */
  async chunkedUploadC2C(
    openid: string,
    fileType: MediaFileType,
    filePath: string,
    fileName: string,
    onProgress?: (progress: ChunkedUploadProgress) => void,
  ): Promise<{ file_uuid: string; file_info: string; ttl: number }> {
    const fileSize = await getFileSize(filePath);
    const hashes = await computeFileHashes(filePath, fileSize);

    // 申请上传
    const prepareResp = await this.uploadPrepareC2C(openid, fileType, fileName, fileSize, hashes);
    const { upload_id, parts } = prepareResp;
    const block_size = Number(prepareResp.block_size);

    const maxConcurrent = Math.min(prepareResp.concurrency ? Number(prepareResp.concurrency) : 1, 10);

    let completedParts = 0;
    let uploadedBytes = 0;

    const uploadPart = async (part: { index: number; presigned_url: string }): Promise<void> => {
      const partIndex = part.index;
      const offset = (partIndex - 1) * block_size;
      const length = Math.min(block_size, fileSize - offset);

      const partBuffer = await readFileChunk(filePath, offset, length);
      const md5Hex = crypto.createHash("md5").update(partBuffer).digest("hex");

      await putToPresignedUrl(part.presigned_url, partBuffer);
      await this.uploadPartFinishC2C(openid, upload_id, partIndex, length, md5Hex);

      completedParts++;
      uploadedBytes += length;

      if (onProgress) {
        onProgress({ completedParts, totalParts: parts.length, uploadedBytes, totalBytes: fileSize });
      }
    };

    await runWithConcurrency(parts.map(part => () => uploadPart(part)), maxConcurrent);

    return this.completeUploadC2C(openid, upload_id);
  }

  /**
   * Group 本地文件分片上传
   */
  async chunkedUploadGroup(
    groupOpenid: string,
    fileType: MediaFileType,
    filePath: string,
    fileName: string,
    onProgress?: (progress: ChunkedUploadProgress) => void,
  ): Promise<{ file_uuid: string; file_info: string; ttl: number }> {
    const fileSize = await getFileSize(filePath);
    const hashes = await computeFileHashes(filePath, fileSize);

    const prepareResp = await this.uploadPrepareGroup(groupOpenid, fileType, fileName, fileSize, hashes);
    const { upload_id, parts } = prepareResp;
    const block_size = Number(prepareResp.block_size);

    const maxConcurrent = Math.min(prepareResp.concurrency ? Number(prepareResp.concurrency) : 1, 10);

    let completedParts = 0;
    let uploadedBytes = 0;

    const uploadPart = async (part: { index: number; presigned_url: string }): Promise<void> => {
      const partIndex = part.index;
      const offset = (partIndex - 1) * block_size;
      const length = Math.min(block_size, fileSize - offset);

      const partBuffer = await readFileChunk(filePath, offset, length);
      const md5Hex = crypto.createHash("md5").update(partBuffer).digest("hex");

      await putToPresignedUrl(part.presigned_url, partBuffer);
      await this.uploadPartFinishGroup(groupOpenid, upload_id, partIndex, length, md5Hex);

      completedParts++;
      uploadedBytes += length;

      if (onProgress) {
        onProgress({ completedParts, totalParts: parts.length, uploadedBytes, totalBytes: fileSize });
      }
    };

    await runWithConcurrency(parts.map(part => () => uploadPart(part)), maxConcurrent);

    return this.completeUploadGroup(groupOpenid, upload_id);
  }

  /**
   * 发送 C2C 本地图片消息
   */
  async sendC2CLocalImageMessage(
    openid: string,
    filePath: string,
    msgId?: string,
    content?: string,
  ): Promise<MessageResponse> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "image.png";
    const uploadResult = await this.chunkedUploadC2C(openid, MediaFileType.IMAGE, filePath, fileName);
    return this.sendC2CMediaMessage(openid, uploadResult.file_info, msgId, content);
  }

  /**
   * 发送群聊本地图片消息
   */
  async sendGroupLocalImageMessage(
    groupOpenid: string,
    filePath: string,
    msgId?: string,
    content?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "image.png";
    const uploadResult = await this.chunkedUploadGroup(groupOpenid, MediaFileType.IMAGE, filePath, fileName);
    return this.sendGroupMediaMessage(groupOpenid, uploadResult.file_info, msgId, content);
  }

  /**
   * 发送 C2C 本地语音消息
   */
  async sendC2CLocalVoiceMessage(
    openid: string,
    filePath: string,
    msgId?: string,
  ): Promise<MessageResponse> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "voice.silk";
    const uploadResult = await this.chunkedUploadC2C(openid, MediaFileType.VOICE, filePath, fileName);
    return this.sendC2CMediaMessage(openid, uploadResult.file_info, msgId);
  }

  /**
   * 发送群聊本地语音消息
   */
  async sendGroupLocalVoiceMessage(
    groupOpenid: string,
    filePath: string,
    msgId?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "voice.silk";
    const uploadResult = await this.chunkedUploadGroup(groupOpenid, MediaFileType.VOICE, filePath, fileName);
    return this.sendGroupMediaMessage(groupOpenid, uploadResult.file_info, msgId);
  }

  /**
   * 发送 C2C 本地视频消息
   */
  async sendC2CLocalVideoMessage(
    openid: string,
    filePath: string,
    msgId?: string,
    content?: string,
  ): Promise<MessageResponse> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "video.mp4";
    const uploadResult = await this.chunkedUploadC2C(openid, MediaFileType.VIDEO, filePath, fileName);
    return this.sendC2CMediaMessage(openid, uploadResult.file_info, msgId, content);
  }

  /**
   * 发送群聊本地视频消息
   */
  async sendGroupLocalVideoMessage(
    groupOpenid: string,
    filePath: string,
    msgId?: string,
    content?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "video.mp4";
    const uploadResult = await this.chunkedUploadGroup(groupOpenid, MediaFileType.VIDEO, filePath, fileName);
    return this.sendGroupMediaMessage(groupOpenid, uploadResult.file_info, msgId, content);
  }

  /**
   * 发送 C2C 本地文件消息
   */
  async sendC2CLocalFileMessage(
    openid: string,
    filePath: string,
    msgId?: string,
    content?: string,
  ): Promise<MessageResponse> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "file";
    const uploadResult = await this.chunkedUploadC2C(openid, MediaFileType.FILE, filePath, fileName);
    return this.sendC2CMediaMessage(openid, uploadResult.file_info, msgId, content);
  }

  /**
   * 发送群聊本地文件消息
   */
  async sendGroupLocalFileMessage(
    groupOpenid: string,
    filePath: string,
    msgId?: string,
    content?: string,
  ): Promise<{ id: string; timestamp: string }> {
    const fileName = filePath.split(/[/\\]/).pop() ?? "file";
    const uploadResult = await this.chunkedUploadGroup(groupOpenid, MediaFileType.FILE, filePath, fileName);
    return this.sendGroupMediaMessage(groupOpenid, uploadResult.file_info, msgId, content);
  }
}
