/**
 * 消息事件分发器
 */

import type {
  MessageEventType,
  C2CMessageEvent,
  GroupMessageEvent,
  GuildMessageEvent,
  InteractionEvent,
  MessageEvent,
} from "../types/index.js";

type EventHandler = (event: MessageEvent) => void | Promise<void>;

interface Handlers {
  [eventType: string]: Set<EventHandler>;
}

/**
 * 消息事件分发器
 *
 * 负责将 WebSocket 收到的原始事件转换为统一的 MessageEvent 格式，
 * 并分发给注册的处理器
 */
export class EventDispatcher {
  private handlers: Handlers = {};
  private anyHandler: Set<EventHandler> = new Set();

  /**
   * 订阅事件
   */
  on(eventType: MessageEventType, handler: EventHandler): () => void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = new Set();
    }
    this.handlers[eventType].add(handler);

    // 返回取消订阅的函数
    return () => {
      this.handlers[eventType]?.delete(handler);
    };
  }

  /**
   * 订阅一次性事件
   */
  once(eventType: MessageEventType, handler: EventHandler): () => void {
    const wrapped: EventHandler = async (event) => {
      this.off(eventType, wrapped);
      await handler(event);
    };
    return this.on(eventType, wrapped);
  }

  /**
   * 取消订阅
   */
  off(eventType: MessageEventType, handler: EventHandler): void {
    this.handlers[eventType]?.delete(handler);
  }

  /**
   * 订阅所有事件
   */
  onAny(handler: EventHandler): () => void {
    this.anyHandler.add(handler);
    return () => {
      this.anyHandler.delete(handler);
    };
  }

  /**
   * 分发事件
   */
  async dispatch(
    eventType: MessageEventType,
    raw: C2CMessageEvent | GroupMessageEvent | GuildMessageEvent | InteractionEvent,
  ): Promise<void> {
    const event = this.normalize(eventType, raw);

    // 调用特定类型处理器
    const handlers = this.handlers[eventType];
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`[qqbot-sdk] Handler error for ${eventType}: ${err}`);
        }
      }
    }

    // 调用 any handler
    for (const handler of this.anyHandler) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[qqbot-sdk] AnyHandler error: ${err}`);
      }
    }
  }

  /**
   * 将原始事件转换为统一格式
   */
  private normalize(
    eventType: MessageEventType,
    raw: C2CMessageEvent | GroupMessageEvent | GuildMessageEvent | InteractionEvent,
  ): MessageEvent {
    switch (eventType) {
      case "C2C_MESSAGE_CREATE": {
        const r = raw as C2CMessageEvent;
        return {
          type: eventType,
          id: r.id,
          content: r.content,
          author: {
            id: r.author.id,
            union_openid: r.author.union_openid,
            user_openid: r.author.user_openid,
          },
          attachments: r.attachments,
          raw,
        };
      }
      case "GROUP_AT_MESSAGE_CREATE": {
        const r = raw as GroupMessageEvent;
        return {
          type: eventType,
          id: r.id,
          content: r.content,
          author: {
            id: r.author.id,
            member_openid: r.author.member_openid,
            username: r.author.username,
          },
          group_openid: r.group_openid,
          attachments: r.attachments,
          raw,
        };
      }
      case "DIRECT_MESSAGE_CREATE":
      case "AT_MESSAGE_CREATE": {
        const r = raw as GuildMessageEvent;
        return {
          type: eventType,
          id: r.id,
          content: r.content,
          author: {
            id: r.author.id,
            username: r.author.username,
          },
          channelId: r.channel_id,
          guildId: r.guild_id,
          attachments: r.attachments,
          raw,
        };
      }
      case "INTERACTION_CREATE": {
        const r = raw as InteractionEvent;
        return {
          type: eventType,
          id: r.id,
          content: "",
          author: {
            id: r.user_openid ?? r.group_member_openid ?? "",
          },
          raw,
        };
      }
      default: {
        return {
          type: eventType,
          id: (raw as { id: string }).id ?? "",
          content: (raw as { content: string }).content ?? "",
          author: { id: "" },
          raw,
        };
      }
    }
  }
}
