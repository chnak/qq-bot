/**
 * 流式消息会话
 */

import {
  StreamInputMode,
  StreamInputState,
  StreamContentType,
} from "./types/index.js";
import { QQBotAPIClient } from "./api/client.js";

type ChunkHandler = (content: string) => void | Promise<void>;
type DoneHandler = () => void | Promise<void>;
type ErrorHandler = (err: unknown) => void | Promise<void>;

interface StreamHandlers {
  chunk?: ChunkHandler;
  done?: DoneHandler;
  error?: ErrorHandler;
}

/**
 * 流式消息会话
 *
 * 用于 C2C 私聊的流式消息发送
 */
export class StreamSession {
  private api: QQBotAPIClient;
  private openid: string;
  private msgId: string;
  private eventId: string;
  private handlers: StreamHandlers;
  private streamMsgId: string | null = null;
  private msgSeq: number | null = null;
  private index = 0;
  private accumulatedContent = "";
  private isCompleted = false;

  constructor(
    api: QQBotAPIClient,
    openid: string,
    msgId: string,
    eventId: string,
    handlers: StreamHandlers,
  ) {
    this.api = api;
    this.openid = openid;
    this.msgId = msgId;
    this.eventId = eventId;
    this.handlers = handlers;
  }

  /**
   * 发送流式内容（累积模式）
   * content 为要追加的新内容，会与之前发送的内容累积后一起发送
   */
  async write(content: string): Promise<void> {
    if (this.isCompleted) {
      throw new Error("Stream session already completed");
    }

    // 累积内容
    this.accumulatedContent += content;
    const currentIndex = this.index++;

    // 如果还没有 streamMsgId，先发送首片建立会话
    if (!this.streamMsgId) {
      this.msgSeq = this.api.getNextMsgSeq(this.msgId);
      const resp = await this.api.sendC2CStreamMessage(this.openid, {
        input_mode: StreamInputMode.REPLACE,
        input_state: StreamInputState.GENERATING,
        content_type: StreamContentType.MARKDOWN,
        content_raw: this.accumulatedContent,
        event_id: this.eventId,
        msg_id: this.msgId,
        msg_seq: this.msgSeq,
        index: currentIndex,
      });

      this.streamMsgId = resp.id;
      this.handlers.chunk?.(content);
      return;
    }

    // 后续分片：发送累积的完整内容
    await this.api.sendC2CStreamMessage(this.openid, {
      input_mode: StreamInputMode.REPLACE,
      input_state: StreamInputState.GENERATING,
      content_type: StreamContentType.MARKDOWN,
      content_raw: this.accumulatedContent,
      event_id: this.eventId,
      msg_id: this.msgId,
      stream_msg_id: this.streamMsgId,
      msg_seq: this.msgSeq!,
      index: currentIndex,
    });

    this.handlers.chunk?.(content);
  }

  /**
   * 标记流式消息完成
   */
  async done(): Promise<void> {
    if (this.isCompleted) {
      return;
    }
    this.isCompleted = true;

    if (!this.streamMsgId) {
      // 从未发送过任何内容，不需要发送终结
      this.handlers.done?.();
      return;
    }

    try {
      await this.api.sendC2CStreamMessage(this.openid, {
        input_mode: StreamInputMode.REPLACE,
        input_state: StreamInputState.DONE,
        content_type: StreamContentType.MARKDOWN,
        content_raw: this.accumulatedContent,
        event_id: this.eventId,
        msg_id: this.msgId,
        stream_msg_id: this.streamMsgId,
        msg_seq: this.msgSeq!,
        index: this.index,
      });
    } catch (err) {
      this.handlers.error?.(err);
      return;
    }

    this.handlers.done?.();
  }
}
