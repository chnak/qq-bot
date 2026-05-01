/**
 * WebSocket 连接管理
 */

import WebSocket from "ws";
import type { Logger } from "../types/index.js";

// 重连配置
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000, 60000];
const MAX_RECONNECT_ATTEMPTS = 100;

// intents
const INTENTS = {
  GUILTS: 1 << 0,
  GUILD_MEMBERS: 1 << 1,
  PUBLIC_GUILD_MESSAGES: 1 << 30,
  DIRECT_MESSAGE: 1 << 12,
  GROUP_AND_C2C: 1 << 25,
  INTERACTION: 1 << 26,
};

const FULL_INTENTS =
  INTENTS.PUBLIC_GUILD_MESSAGES |
  INTENTS.DIRECT_MESSAGE |
  INTENTS.GROUP_AND_C2C |
  INTENTS.INTERACTION;

export interface ConnectionOptions {
  gatewayUrl: string;
  accessToken: string;
  log?: Logger;
  onConnected?: () => void;
  onDisconnected?: (code: number, reason: string) => void;
  onError?: (error: Error) => void;
  onDispatch?: (op: number, d: unknown, s: number | null, t: string | null) => void;
  /** 当 token 无效时回调，用于刷新 token 后重连 */
  onTokenInvalid?: () => void;
}

/**
 * WebSocket 连接状态
 */
export type ConnectionState = "connecting" | "connected" | "disconnecting" | "disconnected";

/**
 * WebSocket 连接实例
 */
export class WebSocketConnection {
  private ws: WebSocket | null = null;
  private gatewayUrl: string;
  private accessToken: string;
  private log?: Logger;
  private onConnected?: () => void;
  private onDisconnected?: (code: number, reason: string) => void;
  private onError?: (error: Error) => void;
  private onDispatch?: (op: number, d: unknown, s: number | null, t: string | null) => void;
  private onTokenInvalid?: () => void;

  private _state: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private abortSignal: AbortSignal | null = null;
  private heartbeatInterval = 30000;
  private lastSeq: number | null = null;
  private connectRetries = 0;
  private maxConnectRetries = 5;
  private connectRetryDelay = 1000;

  constructor(options: ConnectionOptions) {
    this.gatewayUrl = options.gatewayUrl;
    this.accessToken = options.accessToken;
    this.log = options.log;
    this.onConnected = options.onConnected;
    this.onDisconnected = options.onDisconnected;
    this.onError = options.onError;
    this.onDispatch = options.onDispatch;
    this.onTokenInvalid = options.onTokenInvalid;
  }

  /**
   * 当前连接状态
   */
  get connectionState(): ConnectionState {
    return this._state;
  }

  /**
   * 连接到 WebSocket 网关
   */
  async connect(abortSignal?: AbortSignal): Promise<void> {
    this.abortSignal = abortSignal ?? null;
    this._state = "connecting";

    return this.connectInternal();
  }

  private async connectInternal(): Promise<void> {
    if (this._state === "connected" || this._state === "disconnecting") {
      return;
    }

    this._state = "connecting";
    this.log?.info("[qqbot-sdk] Connecting to gateway...");

    // 构建带授权的 URL（与原始 QQ Bot 实现一致）
    const wsUrl = new URL(this.gatewayUrl);
    wsUrl.searchParams.set("access_token", this.accessToken);

    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl.toString());
      } catch (err) {
        this.handleConnectError(err instanceof Error ? err : new Error(String(err)), reject, wsUrl.toString());
        return;
      }

      this.ws = ws;

      const rejectOnce = (err: Error) => {
        ws.removeAllListeners();
        reject(err);
      };

      ws.on("open", () => {
        this._state = "connected";
        this.reconnectAttempts = 0;
        this.connectRetries = 0;
        this.log?.info("[qqbot-sdk] Connected to gateway");
        this.startHeartbeat();
        this.onConnected?.();
        resolve();
      });

      ws.on("message", (data: WebSocket.RawData) => {
        this.handleMessage(data);
      });

      ws.on("close", (code: number, reason: Buffer) => {
        this._state = "disconnected";
        this.stopHeartbeat();
        const reasonStr = reason.toString();
        this.log?.info(`[qqbot-sdk] Disconnected: code=${code}, reason=${reasonStr}`);
        this.onDisconnected?.(code, reasonStr);

        // 4004: Token 无效，需要刷新 token 后重连
        if (code === 4004) {
          this.log?.info("[qqbot-sdk] Token invalid (code=4004), triggering token refresh...");
          this.onTokenInvalid?.();
          return;
        }

        this.scheduleReconnect();
      });

      ws.on("error", (err: Error) => {
        this.log?.error(`[qqbot-sdk] WebSocket error: ${err.message}`);
        this.onError?.(err);
        this.handleConnectError(err, reject, wsUrl.toString());
      });

      // 超时
      setTimeout(() => {
        if (this._state === "connecting") {
          ws.terminate();
          rejectOnce(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  /**
   * 处理连接错误（带重试）
   */
  private handleConnectError(err: Error, reject: (err: Error) => void, wsUrl: string): void {
    if (this._state === "disconnecting" || this._state === "disconnected") {
      reject(err);
      return;
    }

    if (this.abortSignal?.aborted) {
      reject(err);
      return;
    }

    if (this.connectRetries >= this.maxConnectRetries) {
      this.log?.error(`[qqbot-sdk] Max connection retries (${this.maxConnectRetries}) reached`);
      reject(err);
      return;
    }

    this.connectRetries++;
    const delay = this.connectRetryDelay * Math.pow(2, this.connectRetries - 1);
    this.log?.info(`[qqbot-sdk] Connection failed, retrying in ${delay}ms (${this.connectRetries}/${this.maxConnectRetries}): ${err.message}`);

    setTimeout(() => {
      void this.connectInternal();
    }, delay);
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(data.toString()) as { op?: number; d?: unknown; s?: number; t?: string };
      const op = msg.op ?? 0;
      const d = msg.d;
      const s = msg.s ?? null;
      const t = msg.t ?? null;

      const dStr = d !== undefined ? JSON.stringify(d).substring(0, 300) : "undefined";
      this.log?.debug?.(`[qqbot-sdk] Raw: op=${op}, t=${t}, s=${s}, d=${dStr}`);

      // 收到 HELLO (op=10) -> 发送 IDENTIFY
      if (op === 10) {
        this.handleHello(d as { heartbeat_interval?: number; url?: string } | null);
        return;
      }

      // 收到 READY (op=0, t=READY) -> 连接成功
      if (op === 0 && t === "READY") {
        this.log?.info("[qqbot-sdk] Received READY event, connection established!");
        return;
      }

      // 收到 HEARTBEAT_REQUEST -> 发送 HEARTBEAT
      if (op === 1) {
        this.sendHeartbeat();
        return;
      }

      // 收到 HEARTBEAT_ACK -> 忽略
      if (op === 11) {
        return;
      }

      // 断开连接
      if (op === 7) {
        if (this.log?.warn) {
          this.log.warn("[qqbot-sdk] Received reconnect opcode");
        } else {
          this.log?.info?.("[qqbot-sdk] Received reconnect opcode");
        }
        this.scheduleReconnect();
        return;
      }

      // 断开连接（无效 token）
      if (op === 9) {
        this.log?.error("[qqbot-sdk] Invalid access token");
        this.onError?.(new Error("Invalid access token"));
        return;
      }

      // 保存 seq
      if (s) {
        this.lastSeq = s;
      }

      // 分发消息
      if (this.onDispatch) {
        this.onDispatch(op, d, s, t);
      }
    } catch (err) {
      this.log?.error(`[qqbot-sdk] Failed to parse message: ${err}`);
    }
  }

  /**
   * 处理 HELLO 事件
   */
  private handleHello(data: { heartbeat_interval?: number; url?: string } | null): void {
    if (data?.heartbeat_interval) {
      this.heartbeatInterval = data.heartbeat_interval;
    }

    this.log?.info(`[qqbot-sdk] Received HELLO, heartbeat_interval=${this.heartbeatInterval}ms`);

    // 发送 IDENTIFY
    this.sendIdentify();
  }

  /**
   * 发送 IDENTIFY
   */
  private sendIdentify(): void {
    const token = `QQBot ${this.accessToken}`;
    const identify = {
      op: 2,
      d: {
        token,
        intents: FULL_INTENTS,
        shard: [0, 1],
      },
    };

    const identifyStr = JSON.stringify(identify);
    this.ws?.send(identifyStr);
    this.log?.info(`[qqbot-sdk] Sent IDENTIFY: token=${token.substring(0, 20)}..., intents=${FULL_INTENTS}, identify=${identifyStr}`);
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    const heartbeat = {
      op: 1,
      d: this.lastSeq,
    };
    this.ws?.send(JSON.stringify(heartbeat));
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (this._state === "disconnecting" || this._state === "disconnected") {
      return;
    }

    if (this.abortSignal?.aborted) {
      this._state = "disconnected";
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.log?.error("[qqbot-sdk] Max reconnect attempts reached");
      this._state = "disconnected";
      return;
    }

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts++;
    this.log?.info(`[qqbot-sdk] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      void this.connectInternal();
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect(code = 1000, reason = "Normal closure"): void {
    this._state = "disconnecting";
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }

    this._state = "disconnected";
    this.log?.info("[qqbot-sdk] Disconnected by user");
  }

  /**
   * 更新 token 和网关 URL（token 刷新后调用）
   */
  updateToken(gatewayUrl: string, accessToken: string): void {
    this.gatewayUrl = gatewayUrl;
    this.accessToken = accessToken;
    this.log?.info("[qqbot-sdk] Token updated, will reconnect with new token");
  }
}
