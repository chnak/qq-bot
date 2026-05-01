# QQ Bot SDK API 文档

## 目录

- [QQBotAPIClient](#qqbotapiclient)
- [createQQBotClient](#createqqbotclient)
- [WebSocketConnection](#websocketconnection)
- [EventDispatcher](#eventdispatcher)
- [StreamSession](#streamsession)
- [类型定义](#类型定义)

---

## QQBotAPIClient

API 客户端，用于发送消息和调用 QQ 开放平台 API。

### 构造函数

```typescript
const api = new QQBotAPIClient({
  appId: string;           // 应用 ID (必填)
  clientSecret?: string;    // 应用密钥
  accessToken?: string;     // 直接传入 access token
  markdownSupport?: boolean; // 启用 Markdown 支持 (默认 false)
  log?: Logger;             // 日志实例
});
```

### 方法

#### getToken()

获取 access token。

```typescript
const token: string = await api.getToken();
```

#### getGatewayUrl()

获取 WebSocket 网关 URL。

```typescript
const url: string = await api.getGatewayUrl();
```

#### sendC2CMessage()

发送 C2C 私聊文本消息。

```typescript
const result: MessageResponse = await api.sendC2CMessage(
  openid: string,    // 用户 openid
  content: string,   // 消息内容
  msgId?: string,    // 原消息 ID (用于回复)
);
```

#### sendGroupMessage()

发送群聊文本消息。

```typescript
const result: MessageResponse = await api.sendGroupMessage(
  groupOpenid: string,  // 群 openid
  content: string,      // 消息内容
  msgId?: string,       // 原消息 ID
);
```

#### sendChannelMessage()

发送频道消息。

```typescript
const result: { id: string; timestamp: string } = await api.sendChannelMessage(
  channelId: string,  // 频道 ID
  content: string,     // 消息内容
  msgId?: string,     // 原消息 ID
);
```

#### sendC2CImageMessage()

发送 C2C 图片消息 (URL 方式)。

```typescript
const result: MessageResponse = await api.sendC2CImageMessage(
  openid: string,     // 用户 openid
  imageUrl: string,   // 图片 URL
  msgId?: string,     // 原消息 ID
  content?: string,   // 附加内容
);
```

#### sendC2CVoiceMessage()

发送 C2C 语音消息 (URL 方式)。

```typescript
const result: MessageResponse = await api.sendC2CVoiceMessage(
  openid: string,        // 用户 openid
  voiceUrl?: string,     // 语音 URL
  voiceBase64?: string,  // 语音 Base64
  msgId?: string,       // 原消息 ID
);
```

#### sendC2CLocalImageMessage()

发送 C2C 本地图片消息 (分片上传)。

```typescript
const result: MessageResponse = await api.sendC2CLocalImageMessage(
  openid: string,     // 用户 openid
  filePath: string,   // 本地文件路径
  msgId?: string,     // 原消息 ID
  content?: string,   // 附加内容
);
```

#### sendC2CLocalVoiceMessage()

发送 C2C 本地语音消息 (分片上传)。

```typescript
const result: MessageResponse = await api.sendC2CLocalVoiceMessage(
  openid: string,     // 用户 openid
  filePath: string,   // 本地文件路径
  msgId?: string,     // 原消息 ID
);
```

#### sendC2CLocalVideoMessage()

发送 C2C 本地视频消息 (分片上传)。

```typescript
const result: MessageResponse = await api.sendC2CLocalVideoMessage(
  openid: string,     // 用户 openid
  filePath: string,   // 本地文件路径
  msgId?: string,     // 原消息 ID
  content?: string,   // 附加内容
);
```

#### sendC2CLocalFileMessage()

发送 C2C 本地文件消息 (分片上传)。

```typescript
const result: MessageResponse = await api.sendC2CLocalFileMessage(
  openid: string,     // 用户 openid
  filePath: string,   // 本地文件路径
  msgId?: string,     // 原消息 ID
  content?: string,   // 附加内容
);
```

#### sendGroupLocalImageMessage()

发送群聊本地图片消息。

```typescript
const result: { id: string; timestamp: string } = await api.sendGroupLocalImageMessage(
  groupOpenid: string,  // 群 openid
  filePath: string,     // 本地文件路径
  msgId?: string,
  content?: string,
);
```

#### sendGroupLocalVoiceMessage()

发送群聊本地语音消息。

```typescript
const result: { id: string; timestamp: string } = await api.sendGroupLocalVoiceMessage(
  groupOpenid: string,  // 群 openid
  filePath: string,     // 本地文件路径
  msgId?: string,
);
```

#### sendGroupLocalVideoMessage()

发送群聊本地视频消息。

```typescript
const result: { id: string; timestamp: string } = await api.sendGroupLocalVideoMessage(
  groupOpenid: string,  // 群 openid
  filePath: string,     // 本地文件路径
  msgId?: string,
  content?: string,
);
```

#### sendGroupLocalFileMessage()

发送群聊本地文件消息。

```typescript
const result: { id: string; timestamp: string } = await api.sendGroupLocalFileMessage(
  groupOpenid: string,  // 群 openid
  filePath: string,     // 本地文件路径
  msgId?: string,
  content?: string,
);
```

#### acknowledgeInteraction()

确认按钮交互。

```typescript
await api.acknowledgeInteraction(
  interactionId: string,              // 交互 ID
  code?: 0 | 1 | 2 | 3 | 4 | 5,      // 响应码 (默认 0)
  data?: Record<string, unknown>,      // 自定义数据
);
```

#### chunkedUploadC2C()

C2C 分片上传核心方法。

```typescript
const result: { file_uuid: string; file_info: string; ttl: number } = await api.chunkedUploadC2C(
  openid: string,                           // 用户 openid
  fileType: MediaFileType,                  // 文件类型
  filePath: string,                         // 本地文件路径
  fileName: string,                          // 文件名
  onProgress?: (progress: ChunkedUploadProgress) => void,
);

interface ChunkedUploadProgress {
  completedParts: number;   // 已完成分片数
  totalParts: number;       // 总分片数
  uploadedBytes: number;    // 已上传字节数
  totalBytes: number;      // 总字节数
}
```

---

## createQQBotClient

创建完整的 QQ Bot 客户端，同时支持 WebSocket 接收消息和 API 发送消息。

### 函数签名

```typescript
function createQQBotClient(config: QQBotClientConfig & { log?: Logger }): QQBotClient;
```

### QQBotClient 接口

#### 连接管理

```typescript
// 连接 WebSocket
await client.connect();

// 断开连接
client.disconnect();

// 连接状态
const isConnected: boolean = client.isConnected;
```

#### 事件订阅

```typescript
// 订阅事件，返回取消订阅函数
const unsubscribe = client.on(
  event: MessageEventType,
  handler: (event: MessageEvent) => void | Promise<void>
): () => void;

// 订阅一次性事件
const unsubscribe = client.once(
  event: MessageEventType,
  handler: (event: MessageEvent) => void | Promise<void>
): () => void;

// 取消订阅
client.off(event: MessageEventType, handler: Handler): void;

// 订阅所有事件
const unsubscribe = client.onAny(
  handler: (event: MessageEvent) => void | Promise<void>
): () => void;
```

#### 消息发送

```typescript
// C2C 私聊消息
await client.sendC2CMessage({
  openid: string;
  content: string;
  msgId?: string;
});

// 群聊消息
await client.sendGroupMessage({
  groupOpenid: string;
  content: string;
  msgId?: string;
});

// 频道消息
await client.sendChannelMessage({
  channelId: string;
  guildId: string;
  content: string;
  msgId?: string;
});
```

#### 富媒体消息

```typescript
// C2C 图片 (URL)
await client.sendC2CImageMessage({
  openid: string;
  imageUrl: string;
  msgId?: string;
  content?: string;
});

// C2C 语音 (URL)
await client.sendC2CVoiceMessage({
  openid: string;
  voiceUrl?: string;
  voiceBase64?: string;
  msgId?: string;
});

// C2C 本地图片
await client.sendC2CLocalImageMessage({
  openid: string;
  filePath: string;
  msgId?: string;
  content?: string;
});

// C2C 本地语音
await client.sendC2CLocalVoiceMessage({
  openid: string;
  filePath: string;
  msgId?: string;
});

// C2C 本地视频
await client.sendC2CLocalVideoMessage({
  openid: string;
  filePath: string;
  msgId?: string;
  content?: string;
});

// C2C 本地文件
await client.sendC2CLocalFileMessage({
  openid: string;
  filePath: string;
  msgId?: string;
  content?: string;
});

// 群聊本地图片/语音/视频/文件
await client.sendGroupLocalImageMessage({ ... });
await client.sendGroupLocalVoiceMessage({ ... });
await client.sendGroupLocalVideoMessage({ ... });
await client.sendGroupLocalFileMessage({ ... });
```

#### 流式消息

```typescript
await client.createStreamSession({
  openid: string;
  msgId: string;
  eventId?: string;
  onChunk?: (content: string) => void | Promise<void>;
  onDone?: () => void | Promise<void>;
  onError?: (err: unknown) => void | Promise<void>;
});
```

#### 交互确认

```typescript
await client.acknowledgeInteraction(
  interactionId: string,
  code?: 0 | 1 | 2 | 3 | 4 | 5,
  data?: Record<string, unknown>,
);
```

---

## WebSocketConnection

WebSocket 连接管理类。

### 构造函数

```typescript
const connection = new WebSocketConnection({
  gatewayUrl: string;              // 网关 URL
  accessToken: string;             // Access token
  log?: Logger;                    // 日志实例
  onConnected?: () => void;       // 连接成功回调
  onDisconnected?: (code: number, reason: string) => void;
  onError?: (err: Error) => void;
  onDispatch?: (op: number, d: unknown, s: number | null, t: string | null) => void;
});
```

### 方法

#### connect()

建立 WebSocket 连接。

```typescript
await connection.connect();
```

#### disconnect()

断开 WebSocket 连接。

```typescript
connection.disconnect();
```

### 连接状态

```typescript
connection.state;  // ConnectionState: 'disconnected' | 'connecting' | 'connected'
```

---

## EventDispatcher

消息事件分发器。

### 构造函数

```typescript
const dispatcher = new EventDispatcher();
```

### 方法

#### on()

订阅事件。

```typescript
const unsubscribe = dispatcher.on(
  eventType: MessageEventType,
  handler: (event: MessageEvent) => void | Promise<void>
): () => void;
```

#### once()

订阅一次性事件。

```typescript
const unsubscribe = dispatcher.once(
  eventType: MessageEventType,
  handler: (event: MessageEvent) => void | Promise<void>
): () => void;
```

#### off()

取消订阅。

```typescript
dispatcher.off(eventType: MessageEventType, handler: Handler): void;
```

#### onAny()

订阅所有事件。

```typescript
const unsubscribe = dispatcher.onAny(
  handler: (event: MessageEvent) => void | Promise<void>
): () => void;
```

#### dispatch()

分发事件（通常由 WebSocketConnection 调用）。

```typescript
await dispatcher.dispatch(
  eventType: MessageEventType,
  raw: C2CMessageEvent | GroupMessageEvent | GuildMessageEvent | InteractionEvent,
): Promise<void>;
```

---

## StreamSession

流式消息会话，用于发送打字机效果的 C2C 消息。

### 构造函数

```typescript
const stream = new StreamSession(
  api: QQBotAPIClient,
  openid: string,
  msgId: string,           // 用户发送的真实消息 ID
  eventId: string,
  handlers: {
    chunk?: (content: string) => void | Promise<void>;
    done?: () => void | Promise<void>;
    error?: (err: unknown) => void | Promise<void>;
  },
);
```

### 方法

#### write()

发送流式内容（累积模式）。

```typescript
await stream.write(content: string): Promise<void>;
```

#### done()

结束流式消息。

```typescript
await stream.done(): Promise<void>;
```

---

## 类型定义

### MessageEventType

```typescript
type MessageEventType =
  | 'C2C_MESSAGE_CREATE'       // 私聊消息
  | 'GROUP_AT_MESSAGE_CREATE'   // 群聊@消息
  | 'AT_MESSAGE_CREATE'        // 频道@消息
  | 'DIRECT_MESSAGE_CREATE'    // 频道私信
  | 'INTERACTION_CREATE';      // 按钮交互
```

### MessageEvent

```typescript
interface MessageEvent {
  type: MessageEventType;
  id: string;
  content: string;
  author: {
    id: string;
    username?: string;
    union_openid?: string;
    user_openid?: string;
    member_openid?: string;
  };
  group_openid?: string;
  channelId?: string;
  guildId?: string;
  attachments?: MessageAttachment[];
  raw: C2CMessageEvent | GroupMessageEvent | GuildMessageEvent | InteractionEvent;
}
```

### MessageResponse

```typescript
interface MessageResponse {
  id: string;
  timestamp: number | string;
  ext_info?: {
    ref_idx?: string;
  };
}
```

### MediaFileType

```typescript
enum MediaFileType {
  IMAGE = 1,
  VIDEO = 2,
  VOICE = 3,
  FILE = 4,
}
```

### UploadMediaResponse

```typescript
interface UploadMediaResponse {
  file_uuid: string;
  file_info: string;
  ttl: number;
  id?: string;
}
```

### Logger

```typescript
interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  warn?: (msg: string) => void;
  debug?: (msg: string) => void;
}
```

### QQBotClientConfig

```typescript
interface QQBotClientConfig {
  appId: string;
  clientSecret?: string;
  accessToken?: string;
  markdownSupport?: boolean;
}
```

### MessageAttachment

```typescript
interface MessageAttachment {
  content_type: string;
  filename?: string;
  height?: number;
  width?: number;
  size?: number;
  url: string;
  voice_wav_url?: string;
  asr_refer_text?: string;
}
```

### C2CMessageEvent

```typescript
interface C2CMessageEvent {
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
```

### GroupMessageEvent

```typescript
interface GroupMessageEvent {
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
    scope?: 'all' | 'single';
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
```

### InteractionEvent

```typescript
interface InteractionEvent {
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
```
