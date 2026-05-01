# QQ Bot SDK

TypeScript 编写的 QQ 机器人开发 SDK，基于 QQ 开放平台 API v2，支持 WebSocket 长连接接收消息和 HTTP API 发送消息。

## 功能特性

- **WebSocket 网关** - 支持 WebSocket 长连接实时接收消息事件
- **消息发送** - 支持 C2C 私聊、群聊、频道消息发送
- **富媒体消息** - 支持图片、语音、视频、文件（URL 方式和本地上传）
- **本地文件上传** - 支持本地上传图片、语音、视频、文件（分片上传）
- **流式消息** - 支持 C2C 私聊流式消息（打字机效果）
- **按钮交互** - 支持接收和回应按钮交互事件（需平台审核）
- **TypeScript 支持** - 完整的类型定义，开箱即用
- **双模块支持** - 支持 ESM 和 CommonJS

## 安装

```bash
npm install @chnak/qq-bot
```

或使用 yarn：

```bash
yarn add @chnak/qq-bot
```

或使用 pnpm：

```bash
pnpm add @chnak/qq-bot
```

## 模块引入方式

### ESM (ES Modules)

```typescript
import { createQQBotClient } from '@chnak/qq-bot';
```

### CommonJS

```javascript
const { createQQBotClient } = require('@chnak/qq-bot');
```

## 快速开始

### 1. 初始化客户端

```typescript
import { createQQBotClient } from '@chnak/qq-bot';

const client = createQQBotClient({
  appId: 'YOUR_APP_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  log: {
    info: (msg) => console.log('[INFO]', msg),
    error: (msg) => console.error('[ERROR]', msg),
    warn: (msg) => console.warn('[WARN]', msg),
  },
});
```

### 2. 订阅消息事件

```typescript
// 监听私聊消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  console.log('收到私聊消息:', event.content);
  console.log('发送者:', event.author.user_openid);

  // 回复消息
  await client.sendC2CMessage({
    openid: event.author.user_openid,
    content: '收到消息: ' + event.content,
    msgId: event.id,
  });
});

// 监听群聊@消息
client.on('GROUP_AT_MESSAGE_CREATE', async (event) => {
  console.log('收到群消息:', event.content);
  console.log('群ID:', event.group_openid);
  console.log('发送者:', event.author.username);
});

// 监听所有事件（调试用）
client.onAny((event) => {
  console.log(`[事件] ${event.type}`);
});
```

### 3. 启动连接

```typescript
async function main() {
  await client.connect();
  console.log('QQ Bot 已连接!');

  // 保持运行
  setTimeout(() => {
    client.disconnect();
    console.log('Bot 已断开连接');
    process.exit(0);
  }, 60000);
}

main().catch(console.error);
```

## 完整示例

### 自动回复机器人

```typescript
import { createQQBotClient } from '@chnak/qq-bot';

const client = createQQBotClient({
  appId: process.env.APP_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});

// 监听私聊消息，收到后自动回复
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid || event.author.id;

  try {
    // 回复文本消息
    await client.sendC2CMessage({
      openid,
      content: `收到消息: ${event.content}`,
      msgId: event.id,
    });

    // 发送图片（使用 URL）
    await client.sendC2CImageMessage({
      openid,
      imageUrl: 'https://example.com/image.png',
      msgId: event.id,
    });

  } catch (err) {
    console.error('回复失败:', err);
  }
});

// 启动
await client.connect();
console.log('Bot 已启动，按 Ctrl+C 退出');

// 保持运行
process.stdin.resume();
```

### 发送本地文件

```typescript
import { createQQBotClient } from '@chnak/qq-bot';

const client = createQQBotClient({
  appId: process.env.APP_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});

async function sendFiles() {
  // 发送本地图片
  await client.sendC2CLocalImageMessage({
    openid: 'USER_OPENID',
    filePath: '/path/to/image.png',
    content: '这是一张图片',
  });

  // 发送本地视频
  await client.sendC2CLocalVideoMessage({
    openid: 'USER_OPENID',
    filePath: '/path/to/video.mp4',
    content: '这是一段视频',
  });

  // 发送本地文件
  await client.sendC2CLocalFileMessage({
    openid: 'USER_OPENID',
    filePath: '/path/to/document.pdf',
    content: '这是一份文档',
  });

  // 发送本地语音
  await client.sendC2CLocalVoiceMessage({
    openid: 'USER_OPENID',
    filePath: '/path/to/voice.silk',
  });
}
```

### 流式消息（打字机效果）

流式消息会实时更新内容，用户可以看到内容逐渐增加，支持打字机效果。

**注意**：必须从实际收到的消息事件中获取 `msgId` 和 `eventId`。

```typescript
import { createQQBotClient, StreamSession } from '@chnak/qq-bot';

const client = createQQBotClient({
  appId: process.env.APP_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});

// 监听私聊消息，使用流式消息回复
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;

  // 创建流式会话
  const stream = new StreamSession(
    client,  // 直接传入 API 客户端
    openid,
    event.id,              // 使用用户消息的 ID 作为 msgId
    `stream_${Date.now()}`, // 新的 eventId
    {
      chunk: (content) => {
        // 每次 write 后触发，可用于调试
        process.stdout.write(content);
      },
      done: () => {
        console.log('\n流式消息发送完成');
      },
      error: (err) => {
        console.error('流式消息错误:', err);
      },
    }
  );

  // 分段发送内容（累积模式，每次 write 会累积内容后一起发送）
  const chunks = ['第一段：', '这是一条流式消息。\n', '第二段：', '内容会逐步显示！\n'];
  for (const chunk of chunks) {
    await stream.write(chunk);
    // 适当延迟，实现打字机效果
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // 结束流式消息
  await stream.done();
});
```

### Markdown 消息

启用 Markdown 支持后，发送的消息会渲染为 Markdown 格式。

```typescript
import { createQQBotClient } from '@chnak/qq-bot';

const client = createQQBotClient({
  appId: process.env.APP_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  markdownSupport: true, // 启用 markdown 支持
});

// 监听私聊消息，回复 Markdown 消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const markdownContent = `# QQ Bot SDK

这是一个 **Markdown** 消息测试！

## 支持的格式

- **粗体**
- *斜体*
- ~~删除线~~
- \`行内代码\`

## 列表

1. 第一项
2. 第二项
3. 第三项

## 链接

[QQ 开放平台](https://bot.q.qq.com)

## 引用

> 这是一段引用文本

---
*以上内容由 QQ Bot SDK 自动发送*`;

  await client.sendC2CMessage({
    openid: event.author.user_openid,
    content: markdownContent,
    msgId: event.id,
  });
});
```

### 按钮交互处理

发送带按钮的消息，用户点击后会触发 `INTERACTION_CREATE` 事件。

**注意**：
- 消息内嵌按钮需要在 QQ 开放平台审核通过后才能使用
- 可使用 `id` 字段指定已审核的模板，或使用 `content` 字段自定义按钮（同样需要审核）

```typescript
import { createQQBotClient } from '@chnak/qq-bot';

const client = createQQBotClient({
  appId: process.env.APP_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});

// 发送带按钮的消息
async function sendButtonMessage(openid) {
  // 使用模板 ID（需平台审核）
  // await client.sendC2CMessageWithInlineKeyboard(openid, '请选择：', { id: 'TEMPLATE_ID' });

  // 使用自定义按钮（需平台审核）
  await client.sendC2CMessageWithInlineKeyboard(openid, '请点击下方按钮：', {
    content: {
      rows: [
        {
          buttons: [
            {
              id: 'btn_hello',
              render_data: { label: '你好', visited_label: '已点击', style: 1 },
              action: {
                type: 1,           // Callback 类型
                data: 'hello_data',
                permission: { type: 2 },  // 所有人可操作
                click_limit: 1,    // 每人只能点一次
              },
              group_id: 'test_group',
            },
            {
              id: 'btn_bye',
              render_data: { label: '再见', visited_label: '已点击', style: 0 },
              action: {
                type: 1,
                data: 'bye_data',
                permission: { type: 2 },
                click_limit: 1,
              },
              group_id: 'test_group',
            },
          ],
        },
      ],
    },
  });
}

// 监听按钮交互事件
client.on('INTERACTION_CREATE', async (event) => {
  const { button_data, button_id } = event.raw.data.resolved;

  console.log('收到按钮交互:', { button_id, button_data });

  // 确认交互
  await client.acknowledgeInteraction(event.id, 0, {
    msg: `收到按钮点击: ${button_id}`,
  });
});

// 监听私聊消息，发送按钮消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  if (event.content === '按钮') {
    await sendButtonMessage(event.author.user_openid);
  }
});

await client.connect();
```

## API 参考

### 客户端配置

```typescript
interface QQBotClientConfig {
  /** 应用 ID */
  appId: string;
  /** 应用密钥 */
  clientSecret?: string;
  /** 直接传入 access token（如果已获取） */
  accessToken?: string;
  /** 是否启用 markdown 支持（默认 false） */
  markdownSupport?: boolean;
  /** 重试配置 */
  retry?: RetryOptions;
}

interface RetryOptions {
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 初始重试延迟（ms，默认 1000） */
  retryDelayMs?: number;
  /** 是否启用重试（默认 true） */
  enabled?: boolean;
}

interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  warn?: (msg: string) => void;
  debug?: (msg: string) => void;
}
```

### 消息发送 API

#### 文本消息

```typescript
// C2C 私聊消息
await client.sendC2CMessage({
  openid: 'USER_OPENID',
  content: '你好！',
  msgId: 'ORIGINAL_MSG_ID', // 可选，用于回复
});

// 群聊消息
await client.sendGroupMessage({
  groupOpenid: 'GROUP_OPENID',
  content: '大家好！',
  msgId: 'ORIGINAL_MSG_ID',
});

// 频道消息
await client.sendChannelMessage({
  channelId: 'CHANNEL_ID',
  guildId: 'GUILD_ID',
  content: '频道消息',
});
```

#### 正在输入状态

发送 "正在输入" 状态提示，仅 C2C 私聊有效。可用于长消息处理前告知用户。

```typescript
// 发送正在输入状态（默认 60 秒）
await client.sendC2CInputNotify('USER_OPENID');

// 指定保持秒数
await client.sendC2CInputNotify('USER_OPENID', 'MSG_ID', 30);
```

#### Markdown 消息

需要在初始化客户端时设置 `markdownSupport: true`。

```typescript
const client = createQQBotClient({
  appId: 'YOUR_APP_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  markdownSupport: true, // 启用 markdown 支持
});

// 发送 Markdown 格式消息
await client.sendC2CMessage({
  openid: 'USER_OPENID',
  content: `# 标题

这是一个 **粗体** 和 *斜体* 的消息。

## 列表
1. 第一项
2. 第二项

> 引用文本

[链接](https://example.com)`,
  msgId: 'MSG_ID',
});
```

#### 富媒体消息（URL 方式）

```typescript
// 发送图片
await client.sendC2CImageMessage({
  openid: 'USER_OPENID',
  imageUrl: 'https://example.com/image.png',
  msgId: 'MSG_ID',
  content: '图片描述',
});

// 发送语音
await client.sendC2CVoiceMessage({
  openid: 'USER_OPENID',
  voiceUrl: 'https://example.com/voice.silk',
});

// 发送视频
await client.sendC2CVideoMessage({
  openid: 'USER_OPENID',
  videoUrl: 'https://example.com/video.mp4',
});
```

#### 本地文件上传

```typescript
// 发送本地图片
await client.sendC2CLocalImageMessage({
  openid: 'USER_OPENID',
  filePath: '/path/to/image.png',
  msgId: 'MSG_ID',
  content: '图片描述',
});

// 发送本地语音
await client.sendC2CLocalVoiceMessage({
  openid: 'USER_OPENID',
  filePath: '/path/to/voice.silk',
});

// 发送本地视频
await client.sendC2CLocalVideoMessage({
  openid: 'USER_OPENID',
  filePath: '/path/to/video.mp4',
  content: '视频描述',
});

// 发送本地文件
await client.sendC2CLocalFileMessage({
  openid: 'USER_OPENID',
  filePath: '/path/to/file.pdf',
  content: '文件描述',
});
```

#### 群聊富媒体消息

```typescript
// 群聊图片
await client.sendGroupLocalImageMessage({
  groupOpenid: 'GROUP_OPENID',
  filePath: '/path/to/image.png',
});

// 群聊语音
await client.sendGroupLocalVoiceMessage({
  groupOpenid: 'GROUP_OPENID',
  filePath: '/path/to/voice.silk',
});

// 群聊视频
await client.sendGroupLocalVideoMessage({
  groupOpenid: 'GROUP_OPENID',
  filePath: '/path/to/video.mp4',
});

// 群聊文件
await client.sendGroupLocalFileMessage({
  groupOpenid: 'GROUP_OPENID',
  filePath: '/path/to/file.pdf',
});
```

### 事件类型

```typescript
type MessageEventType =
  | 'C2C_MESSAGE_CREATE'      // 私聊消息
  | 'GROUP_AT_MESSAGE_CREATE' // 群聊@消息
  | 'AT_MESSAGE_CREATE'       // 频道@消息
  | 'DIRECT_MESSAGE_CREATE'    // 频道私信
  | 'INTERACTION_CREATE';     // 按钮交互
```

### 流式消息 API

```typescript
// 直接使用 StreamSession（需要传入 API 客户端）
import { QQBotAPIClient, StreamSession } from '@chnak/qq-bot';

const api = new QQBotAPIClient({ appId, clientSecret });

const stream = new StreamSession(
  api,
  openid,
  msgId,           // 必须是用户发送的真实消息 ID
  eventId,         // 事件 ID
  {
    chunk: (content) => {
      // 每次 write 后触发
    },
    done: () => {
      // 流式消息发送完成
    },
    error: (err) => {
      // 发送错误
    },
  }
);

// 发送内容（累积模式）
await stream.write('第一段：');
await stream.write('第二段：');
await stream.write('内容累积后一起发送');

// 结束流式消息
await stream.done();
```

### 事件消息结构

```typescript
interface MessageEvent {
  type: MessageEventType;        // 事件类型
  id: string;                    // 消息 ID
  content: string;               // 消息内容
  author: {
    id: string;                  // 用户 ID
    username?: string;           // 用户名
    union_openid?: string;       // 统一 ID
    user_openid?: string;        // 用户 openid
    member_openid?: string;      // 成员 openid（群聊）
  };
  group_openid?: string;         // 群 ID（仅群聊）
  channelId?: string;            // 频道 ID（仅频道）
  guildId?: string;              // Guild ID（仅频道）
  attachments?: MessageAttachment[]; // 附件
  raw: C2CMessageEvent | GroupMessageEvent | GuildMessageEvent | InteractionEvent; // 原始数据
}
```

## 直接使用 API 客户端

如果你只需要调用 API 发送消息，不需要 WebSocket 连接，可以直接使用 `QQBotAPIClient`：

### ESM

```typescript
import { QQBotAPIClient } from '@chnak/qq-bot';

const api = new QQBotAPIClient({
  appId: 'YOUR_APP_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  markdownSupport: true, // 可选，启用 Markdown 支持
  retry: {
    maxRetries: 3,       // 最大重试次数
    retryDelayMs: 1000,  // 初始重试延迟（指数退避）
    enabled: true,       // 是否启用重试
  },
});

// 发送文本消息
const result = await api.sendC2CMessage('USER_OPENID', '你好！');

// 发送 Markdown 消息（需要启用 markdownSupport）
const mdResult = await api.sendC2CMessage('USER_OPENID', '# 标题\n\n**粗体**内容');

// 发送本地图片
const imageResult = await api.sendC2CLocalImageMessage(
  'USER_OPENID',
  '/path/to/image.png',
  undefined,
  '图片描述'
);

// 获取 access token
const token = await api.getToken();

// 获取网关 URL
const gatewayUrl = await api.getGatewayUrl();
```

### CommonJS

```javascript
const { QQBotAPIClient } = require('@chnak/qq-bot');

const api = new QQBotAPIClient({
  appId: 'YOUR_APP_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  markdownSupport: true,
  retry: {
    maxRetries: 3,
    retryDelayMs: 1000,
    enabled: true,
  },
});

async function main() {
  // 发送文本消息
  const result = await api.sendC2CMessage('USER_OPENID', '你好！');

  // 发送本地图片
  const imageResult = await api.sendC2CLocalImageMessage(
    'USER_OPENID',
    '/path/to/image.png',
    undefined,
    '图片描述'
  );
}

main().catch(console.error);
```

## 文件大小限制

| 类型 | 限制 |
|------|------|
| 图片 (IMAGE) | 30 MB |
| 视频 (VIDEO) | 100 MB |
| 语音 (VOICE) | 20 MB |
| 文件 (FILE) | 100 MB |

## 注意事项

### 关于 openid

- QQ 开放平台使用 `openid` 作为用户唯一标识
- `openid` 是基于 `appId + userId` 加密生成的，无法从 QQ 号直接获取
- **必须让用户先给机器人发消息**，才能从消息事件中获取用户的 openid

### 流式消息

- **必须使用真实的消息 ID** - `msgId` 和 `eventId` 必须来自用户实际发送的消息，不能使用模拟值
- **累积模式** - 每次 `write()` 会累积内容后一起发送到 QQ 服务器
- **前缀不可修改** - QQ 要求后续发送的内容必须保持之前内容的前缀不变
- **网络延迟** - 流式消息的实时性取决于网络状况，如果延迟明显可适当增加分段间隔

### 本地文件上传流程

本地文件上传采用分片上传机制：

1. 计算文件哈希（md5、sha1、md5_10m）
2. 调用 `upload_prepare` 接口获取上传预签名 URL
3. 并行上传所有分片到 COS
4. 调用 `upload_part_finish` 通知每个分片完成
5. 调用 `complete_upload` 完成上传
6. 使用返回的 `file_info` 发送消息

### 按钮交互

- 消息内嵌按钮需要在 QQ 开放平台审核通过后才能使用
- 按钮支持两种类型：
  - **模板按钮**：使用 `id` 字段指定已审核的模板 ID
  - **自定义按钮**：使用 `content` 字段自定义按钮布局（也需要审核）

### 重试机制

SDK 默认启用重试机制，所有 API 请求在失败时会自动重试：

- **网络错误**：自动重试（包括 `fetch failed`、`timeout` 等）
- **服务器错误**：对 502、503、504 等错误自动重试
- **指数退避**：每次重试延迟时间翻倍（1s → 2s → 4s...）
- **可配置**：可通过 `retry` 选项自定义重试次数和延迟

```typescript
const client = createQQBotClient({
  appId: 'YOUR_APP_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  retry: {
    maxRetries: 3,       // 最大重试次数（默认 3）
    retryDelayMs: 1000,  // 初始重试延迟（默认 1000ms）
    enabled: true,       // 是否启用重试（默认 true）
  },
});
```

## 示例

### 完整机器人示例

```typescript
import { createQQBotClient } from '@chnak/qq-bot';

const client = createQQBotClient({
  appId: process.env.APP_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});

// 监听私聊消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;
  const content = event.content.trim();

  // 命令处理
  if (content === '你好') {
    await client.sendC2CMessage({ openid, content: '你好！有什么可以帮助你的吗？' });
  } else if (content === '帮助') {
    await client.sendC2CMessage({
      openid,
      content: '可用命令：\n1. 你好 - 打招呼\n2. 帮助 - 显示帮助信息',
    });
  }
});

// 监听群聊@消息
client.on('GROUP_AT_MESSAGE_CREATE', async (event) => {
  const content = event.content.trim();

  if (content.startsWith('机器人')) {
    await client.sendGroupMessage({
      groupOpenid: event.group_openid!,
      content: '收到！',
    });
  }
});

await client.connect();
console.log('Bot 已启动');
process.stdin.resume();
```

### 消息回复示例

```typescript
// 回复用户消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;

  // 回复文本
  await client.sendC2CMessage({
    openid,
    content: `你发送了: ${event.content}`,
    msgId: event.id,
  });
});
```

### 图片和文件示例

```typescript
// 发送本地图片
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;

  if (event.content === '图片') {
    await client.sendC2CLocalImageMessage({
      openid,
      filePath: './test.png',
      content: '这是一张测试图片',
    });
  }
});

// 发送本地视频
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;

  if (event.content === '视频') {
    await client.sendC2CLocalVideoMessage({
      openid,
      filePath: './video.mp4',
    });
  }
});

// 发送本地文件
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;

  if (event.content === '文件') {
    await client.sendC2CLocalFileMessage({
      openid,
      filePath: './document.pdf',
      content: '文件已发送',
    });
  }
});
```

### 群聊消息示例

```typescript
// 发送群聊文本
await client.sendGroupMessage({
  groupOpenid: 'GROUP_OPENID',
  content: '大家好！',
});

// 发送群聊图片
await client.sendGroupLocalImageMessage({
  groupOpenid: 'GROUP_OPENID',
  filePath: './group-photo.png',
  content: '群聊图片',
});
```

### 流式消息示例

```typescript
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;

  if (event.content === '流式') {
    const stream = await client.createStreamSession({
      openid,
      msgId: event.id,
    });

    const messages = ['第', '一', '条', '流', '式', '消', '息'];

    for (const msg of messages) {
      await stream.write(msg);
      await new Promise(r => setTimeout(r, 200));
    }

    await stream.done();
  }
});
```

### 按钮交互示例

```typescript
client.on('INTERACTION_CREATE', async (event) => {
  const { button_data, button_id } = event.raw.data.resolved;

  console.log(`按钮交互: ${button_id} - ${button_data}`);

  // 确认交互
  await client.acknowledgeInteraction(event.id, 0, {
    msg: '已收到点击',
  });
});
```

## 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 构建
npm run build

# 监听模式构建
npm run dev
```

## 目录结构

```
@chnak/qq-bot/
├── src/
│   ├── index.ts              # 主入口
│   ├── api/
│   │   ├── client.ts         # API 客户端
│   │   └── auth.ts           # 鉴权模块
│   ├── gateway/
│   │   ├── connection.ts     # WebSocket 连接
│   │   └── dispatcher.ts     # 事件分发器
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── utils/
│   │   ├── logger.ts         # 日志工具
│   │   └── file-hash.ts      # 文件哈希工具
│   └── stream-session.ts     # 流式消息会话
├── examples/                  # 示例文件
│   ├── 01-basic-bot.ts       # 基础机器人
│   ├── 02-command-handler.ts # 命令处理器
│   ├── 03-send-media.ts     # 发送媒体文件
│   ├── 04-stream-message.ts  # 流式消息
│   ├── 05-group-bot.ts       # 群聊机器人
│   ├── 06-markdown-bot.ts    # Markdown 消息
│   └── 07-api-only.ts       # 仅 API 模式
├── dist/                     # 编译输出
├── package.json
└── tsconfig.json
```

## License

MIT