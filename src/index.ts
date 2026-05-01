/**
 * QQ Bot SDK
 *
 * TypeScript library for QQ Bot API
 */

// Types
export {
  // Message type constants
  MSG_TYPE_TEXT,
  MSG_TYPE_QUOTE,
  // Stream constants
  StreamInputMode,
  StreamInputState,
  StreamContentType,
  // Types
  type StreamMessageRequest,
  type MessageEventType,
  type MessageAttachment,
  type C2CMessageEvent,
  type GuildMessageEvent,
  type MsgElement,
  type GroupMessageEvent,
  type InteractionEvent,
  type WSPayload,
  type MessageEvent,
  type MessageResponse,
  type MediaFileType,
  type UploadMediaResponse,
  type QQBotClientConfig,
  type RetryOptions,
  type Logger,
} from "./types/index.js";

// API Client
export { QQBotAPIClient } from "./api/client.js";

// Gateway
export { WebSocketConnection, type ConnectionOptions, type ConnectionState } from "./gateway/connection.js";
export { EventDispatcher } from "./gateway/dispatcher.js";

// Stream
export { StreamSession } from "./stream-session.js";

// Utils
export { defaultLogger, noopLogger } from "./utils/logger.js";

// ── Logger 接口 ──
import type { Logger } from "./types/index.js";

// ── 客户端工厂函数 ──
import { QQBotAPIClient } from "./api/client.js";
import { WebSocketConnection } from "./gateway/connection.js";
import { EventDispatcher } from "./gateway/dispatcher.js";
import { StreamSession } from "./stream-session.js";
import { defaultLogger } from "./utils/logger.js";
import type { MessageEventType, MessageEvent, QQBotClientConfig, MessageResponse } from "./types/index.js";

interface QQBotClient {
  // ── 事件订阅 ──
  on(event: MessageEventType, handler: (event: MessageEvent) => void | Promise<void>): () => void;
  once(event: MessageEventType, handler: (event: MessageEvent) => void | Promise<void>): () => void;
  off(event: MessageEventType, handler: (event: MessageEvent) => void | Promise<void>): void;
  onAny(handler: (event: MessageEvent) => void | Promise<void>): () => void;

  // ── 连接 ──
  connect(): Promise<void>;
  disconnect(): void;

  // ── 发送消息 ──
  sendC2CMessage(params: { openid: string; content: string; msgId?: string }): Promise<MessageResponse>;
  sendC2CInputNotify(openid: string, msgId?: string, inputSecond?: number): Promise<void>;
  sendGroupMessage(params: { groupOpenid: string; content: string; msgId?: string }): Promise<MessageResponse>;
  sendChannelMessage(params: { channelId: string; guildId: string; content: string; msgId?: string }): Promise<{ id: string; timestamp: string }>;

  // ── 富媒体消息 ──
  sendC2CImageMessage(params: { openid: string; imageUrl: string; msgId?: string; content?: string }): Promise<MessageResponse>;
  sendGroupImageMessage(params: { groupOpenid: string; imageUrl: string; msgId?: string; content?: string }): Promise<{ id: string; timestamp: string }>;
  sendC2CVoiceMessage(params: { openid: string; voiceUrl?: string; voiceBase64?: string; msgId?: string }): Promise<MessageResponse>;
  sendGroupVoiceMessage(params: { groupOpenid: string; voiceUrl?: string; voiceBase64?: string; msgId?: string }): Promise<{ id: string; timestamp: string }>;

  // ── 交互 ──
  acknowledgeInteraction(interactionId: string, code?: 0 | 1 | 2 | 3 | 4 | 5, data?: Record<string, unknown>): Promise<void>;

  // ── 流式消息 ──
  createStreamSession(params: {
    openid: string;
    msgId: string;
    eventId?: string;
    onChunk?: (content: string) => void | Promise<void>;
    onDone?: () => void | Promise<void>;
    onError?: (err: unknown) => void | Promise<void>;
  }): Promise<StreamSession>;

  // ── 本地文件上传 ──
  sendC2CLocalImageMessage(params: { openid: string; filePath: string; msgId?: string; content?: string }): Promise<MessageResponse>;
  sendGroupLocalImageMessage(params: { groupOpenid: string; filePath: string; msgId?: string; content?: string }): Promise<{ id: string; timestamp: string }>;
  sendC2CLocalVoiceMessage(params: { openid: string; filePath: string; msgId?: string }): Promise<MessageResponse>;
  sendGroupLocalVoiceMessage(params: { groupOpenid: string; filePath: string; msgId?: string }): Promise<{ id: string; timestamp: string }>;
  sendC2CLocalVideoMessage(params: { openid: string; filePath: string; msgId?: string; content?: string }): Promise<MessageResponse>;
  sendGroupLocalVideoMessage(params: { groupOpenid: string; filePath: string; msgId?: string; content?: string }): Promise<{ id: string; timestamp: string }>;
  sendC2CLocalFileMessage(params: { openid: string; filePath: string; msgId?: string; content?: string }): Promise<MessageResponse>;
  sendGroupLocalFileMessage(params: { groupOpenid: string; filePath: string; msgId?: string; content?: string }): Promise<{ id: string; timestamp: string }>;

  // ── 状态 ──
  readonly isConnected: boolean;
}

/**
 * 创建 QQ Bot 客户端
 */
export function createQQBotClient(config: QQBotClientConfig & { log?: Logger }): QQBotClient {
  const log = config.log ?? defaultLogger;
  const api = new QQBotAPIClient({
    appId: config.appId,
    clientSecret: config.clientSecret,
    accessToken: config.accessToken,
    markdownSupport: config.markdownSupport,
    log,
    retry: config.retry,
  });

  const dispatcher = new EventDispatcher();
  let connection: WebSocketConnection | null = null;
  let isConnected = false;
  let gatewayUrl: string | null = null;

  return {
    // ── 事件订阅 ──
    on(event, handler) {
      return dispatcher.on(event, handler);
    },
    once(event, handler) {
      return dispatcher.once(event, handler);
    },
    off(event, handler) {
      dispatcher.off(event, handler);
    },
    onAny(handler) {
      return dispatcher.onAny(handler);
    },

    // ── 连接 ──
    async connect() {
      const connectWithToken = async () => {
        gatewayUrl = await api.getGatewayUrl();
        const token = await api.getToken();

        connection = new WebSocketConnection({
          gatewayUrl: gatewayUrl!,
          accessToken: token,
          log,
          onConnected: () => {
            isConnected = true;
          },
          onDisconnected: () => {
            isConnected = false;
          },
          onDispatch: (op, d, s, t) => {
            if (op === 0 && t && d) {
              void dispatcher.dispatch(t as MessageEventType, d as MessageEvent["raw"]);
            }
          },
          onTokenInvalid: async () => {
            // Token 无效，清除缓存后重新获取并重连
            log?.info("[qqbot-sdk] Refreshing token due to invalid error...");
            api.clearTokenCache();
            try {
              const newToken = await api.getToken();
              gatewayUrl = await api.getGatewayUrl();
              connection?.updateToken(gatewayUrl, newToken);
            } catch (err) {
              log?.error(`[qqbot-sdk] Failed to refresh token: ${err}`);
            }
          },
        });

        await connection.connect();
      };

      await connectWithToken();
    },

    disconnect() {
      connection?.disconnect();
      isConnected = false;
    },

    // ── 发送消息 ──
    async sendC2CMessage({ openid, content, msgId }) {
      return api.sendC2CMessage(openid, content, msgId);
    },

    async sendC2CInputNotify(openid, msgId, inputSecond = 60) {
      return api.sendC2CInputNotify(openid, msgId, inputSecond);
    },

    async sendGroupMessage({ groupOpenid, content, msgId }) {
      return api.sendGroupMessage(groupOpenid, content, msgId);
    },

    async sendChannelMessage({ channelId, guildId, content, msgId }) {
      // Guild ID needed for channel messages - QQ API uses channel_id directly
      return api.sendChannelMessage(channelId, content, msgId);
    },

    // ── 富媒体消息 ──
    async sendC2CImageMessage({ openid, imageUrl, msgId, content }) {
      return api.sendC2CImageMessage(openid, imageUrl, msgId, content);
    },

    async sendGroupImageMessage({ groupOpenid, imageUrl, msgId, content }) {
      return api.sendGroupImageMessage(groupOpenid, imageUrl, msgId, content);
    },

    async sendC2CVoiceMessage({ openid, voiceUrl, voiceBase64, msgId }) {
      return api.sendC2CVoiceMessage(openid, voiceUrl, voiceBase64, msgId);
    },

    async sendGroupVoiceMessage({ groupOpenid, voiceUrl, voiceBase64, msgId }) {
      return api.sendGroupVoiceMessage(groupOpenid, voiceUrl, voiceBase64, msgId);
    },

    // ── 交互 ──
    async acknowledgeInteraction(interactionId, code = 0, data) {
      return api.acknowledgeInteraction(interactionId, code, data);
    },

    // ── 流式消息 ──
    async createStreamSession({ openid, msgId, eventId, onChunk, onDone, onError }) {
      const session = new StreamSession(
        api,
        openid,
        msgId,
        eventId ?? `stream_${Date.now()}`,
        {
          chunk: onChunk,
          done: onDone,
          error: onError,
        },
      );
      return session;
    },

    // ── 本地文件上传 ──
    async sendC2CLocalImageMessage({ openid, filePath, msgId, content }) {
      return api.sendC2CLocalImageMessage(openid, filePath, msgId, content);
    },

    async sendGroupLocalImageMessage({ groupOpenid, filePath, msgId, content }) {
      return api.sendGroupLocalImageMessage(groupOpenid, filePath, msgId, content);
    },

    async sendC2CLocalVoiceMessage({ openid, filePath, msgId }) {
      return api.sendC2CLocalVoiceMessage(openid, filePath, msgId);
    },

    async sendGroupLocalVoiceMessage({ groupOpenid, filePath, msgId }) {
      return api.sendGroupLocalVoiceMessage(groupOpenid, filePath, msgId);
    },

    async sendC2CLocalVideoMessage({ openid, filePath, msgId, content }) {
      return api.sendC2CLocalVideoMessage(openid, filePath, msgId, content);
    },

    async sendGroupLocalVideoMessage({ groupOpenid, filePath, msgId, content }) {
      return api.sendGroupLocalVideoMessage(groupOpenid, filePath, msgId, content);
    },

    async sendC2CLocalFileMessage({ openid, filePath, msgId, content }) {
      return api.sendC2CLocalFileMessage(openid, filePath, msgId, content);
    },

    async sendGroupLocalFileMessage({ groupOpenid, filePath, msgId, content }) {
      return api.sendGroupLocalFileMessage(groupOpenid, filePath, msgId, content);
    },

    // ── 状态 ──
    get isConnected() {
      return isConnected;
    },
  };
}
