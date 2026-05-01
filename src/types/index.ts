// ── QQ 消息类型常量（message_type 枚举值） ──
/** 普通文本消息 */
export const MSG_TYPE_TEXT = 0;
/** 引用（回复）消息 */
export const MSG_TYPE_QUOTE = 103;

// ── 流式消息常量 ──

/** 流式消息输入模式 */
export const StreamInputMode = {
  /** 每次发送的 content_raw 替换整条消息内容 */
  REPLACE: "replace",
} as const;
export type StreamInputMode = (typeof StreamInputMode)[keyof typeof StreamInputMode];

/** 流式消息输入状态 */
export const StreamInputState = {
  /** 正文生成中 */
  GENERATING: 1,
  /** 正文生成结束（终结状态） */
  DONE: 10,
} as const;
export type StreamInputState = (typeof StreamInputState)[keyof typeof StreamInputState];

/** 流式消息内容类型 */
export const StreamContentType = {
  MARKDOWN: "markdown",
} as const;
export type StreamContentType = (typeof StreamContentType)[keyof typeof StreamContentType];

/**
 * 流式消息请求体
 */
export interface StreamMessageRequest {
  /** 输入模式 */
  input_mode: StreamInputMode;
  /** 输入状态 */
  input_state: StreamInputState;
  /** 内容类型 */
  content_type: StreamContentType;
  /** markdown 内容 */
  content_raw: string;
  /** 事件 ID */
  event_id: string;
  /** 原始消息 ID */
  msg_id: string;
  /** 流式消息 ID，首次发送后返回，后续分片需携带 */
  stream_msg_id?: string;
  /** 递增序号 */
  msg_seq: number;
  /** 同一条流式会话内的发送索引，从 0 开始，每次发送前递增；新流式会话重新从 0 开始 */
  index: number;
}

// ── 事件类型 ──

/** 消息事件类型 */
export type MessageEventType =
  | "C2C_MESSAGE_CREATE"
  | "GROUP_AT_MESSAGE_CREATE"
  | "AT_MESSAGE_CREATE"
  | "DIRECT_MESSAGE_CREATE"
  | "INTERACTION_CREATE";

// ── 富媒体附件 ──

/**
 * 富媒体附件
 */
export interface MessageAttachment {
  content_type: string;
  filename?: string;
  height?: number;
  width?: number;
  size?: number;
  url: string;
  voice_wav_url?: string;
  asr_refer_text?: string;
}

// ── 消息事件 ──

/**
 * C2C 消息事件
 */
export interface C2CMessageEvent {
  author: {
    id: string;
    union_openid: string;
    user_openid: string;
  };
  content: string;
  id: string;
  timestamp: string;
  message_scene?: {
    source: string;
    ext?: string[];
  };
  attachments?: MessageAttachment[];
  message_type?: number;
  msg_elements?: MsgElement[];
}

/**
 * 频道 AT 消息事件
 */
export interface GuildMessageEvent {
  id: string;
  channel_id: string;
  guild_id: string;
  content: string;
  timestamp: string;
  author: {
    id: string;
    username?: string;
    bot?: boolean;
  };
  member?: {
    nick?: string;
    joined_at?: string;
  };
  attachments?: MessageAttachment[];
}

/**
 * 消息元素结点
 */
export interface MsgElement {
  msg_idx?: string;
  message_type?: number;
  content?: string;
  attachments?: MessageAttachment[];
  msg_elements?: MsgElement[];
}

/**
 * 群聊 AT 消息事件
 */
export interface GroupMessageEvent {
  author: {
    id: string;
    member_openid: string;
    username?: string;
    bot?: boolean;
  };
  content: string;
  id: string;
  timestamp: string;
  group_id: string;
  group_openid: string;
  message_scene?: {
    source: string;
    ext?: string[];
  };
  attachments?: MessageAttachment[];
  mentions?: Array<{
    scope?: "all" | "single";
    id?: string;
    user_openid?: string;
    member_openid?: string;
    nickname?: string;
    bot?: boolean;
    is_you?: boolean;
  }>;
  message_type?: number;
  msg_elements?: MsgElement[];
}

/**
 * 按钮交互事件（INTERACTION_CREATE）
 */
export interface InteractionEvent {
  id: string;
  type: number;
  scene?: string;
  chat_type?: number;
  timestamp?: string;
  guild_id?: string;
  channel_id?: string;
  user_openid?: string;
  group_openid?: string;
  group_member_openid?: string;
  version: number;
  data: {
    type: number;
    resolved: {
      button_data?: string;
      button_id?: string;
      user_id?: string;
      feature_id?: string;
      message_id?: string;
      require_mention?: string;
      group_policy?: string;
      mention_patterns?: string;
    };
  };
}

/**
 * WebSocket 事件负载
 */
export interface WSPayload {
  op: number;
  d?: unknown;
  s?: number;
  t?: string;
}

// ── 统一事件格式 ──

/**
 * 统一消息事件格式（所有事件经过 dispatcher 转换后的格式）
 */
export interface MessageEvent {
  /** 事件类型 */
  type: MessageEventType;
  /** 事件 ID */
  id: string;
  /** 事件内容 */
  content: string;
  /** 发送者信息 */
  author: {
    id: string;
    username?: string;
    union_openid?: string;
    user_openid?: string;
    member_openid?: string;
  };
  /** 群 ID（仅群聊） */
  group_openid?: string;
  /** 频道 ID（仅频道） */
  channelId?: string;
  /** Guild ID（仅频道） */
  guildId?: string;
  /** 附件 */
  attachments?: MessageAttachment[];
  /** 原始事件数据 */
  raw: C2CMessageEvent | GroupMessageEvent | GuildMessageEvent | InteractionEvent;
}

// ── API 响应 ──

/**
 * 消息发送响应
 */
export interface MessageResponse {
  id: string;
  timestamp: number | string;
  ext_info?: {
    ref_idx?: string;
  };
}

// ── Media 类型 ──

export enum MediaFileType {
  IMAGE = 1,
  VIDEO = 2,
  VOICE = 3,
  FILE = 4,
}

export interface UploadMediaResponse {
  file_uuid: string;
  file_info: string;
  ttl: number;
  id?: string;
}

// ── 客户端配置 ──

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

/**
 * QQ Bot 客户端配置
 */
export interface QQBotClientConfig {
  /** 应用 ID */
  appId: string;
  /** 应用密钥（未提供 accessToken 时需要） */
  clientSecret?: string;
  /** 直接传入 access token（如果已获取） */
  accessToken?: string;
  /** 是否启用 markdown 支持（默认 false） */
  markdownSupport?: boolean;
  /** 重试配置 */
  retry?: RetryOptions;
}

// ── 按钮键盘类型 ──

/** 按钮渲染数据 */
export interface KeyboardRenderData {
  label: string;
  visited_label?: string;
  /** 0=灰色线框  1=蓝色线框  2=推荐回复专用  3=红色字体  4=蓝色背景 */
  style?: 0 | 1 | 2 | 3 | 4;
}

/** 单个按钮 */
export interface KeyboardButton {
  id: string;
  render_data?: KeyboardRenderData;
  action?: {
    type?: number;
    data?: string;
    permission?: unknown;
    click_limit?: number;
  };
  group_id?: string;
}

/** 一行按钮 */
export interface KeyboardRow {
  buttons: KeyboardButton[];
}

/** CustomKeyboard（自定义按钮内容） */
export interface CustomKeyboard {
  rows: KeyboardRow[];
}

/** MessageKeyboard（inline keyboard / keyboard 共用） */
export interface MessageKeyboard {
  /** 模板 ID（与 content 二选一） */
  id?: string;
  /** 自定义内容 */
  content?: CustomKeyboard;
}

/**
 * Inline Keyboard（消息内嵌按钮，触发 INTERACTION_CREATE）
 */
export type InlineKeyboard = MessageKeyboard;

// ── 日志接口 ──

/**
 * 日志接口
 */
export interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  warn?: (msg: string) => void;
  debug?: (msg: string) => void;
}
