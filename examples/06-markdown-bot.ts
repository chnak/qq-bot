/**
 * 示例6: Markdown 消息机器人
 */

import { createQQBotClient } from '../src/index.js';

const client = createQQBotClient({
  appId: process.env.APP_ID || 'YOUR_APP_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  markdownSupport: true, // 启用 Markdown 支持
});

client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;
  const content = event.content.trim();

  console.log(`收到消息: ${content}`);

  if (content === 'md' || content === 'markdown') {
    const markdown = `# QQ Bot SDK

这是一个 **Markdown** 消息测试！

## 支持的格式

- **粗体文本**
- *斜体文本*
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
      openid,
      content: markdown,
      msgId: event.id,
    });
    console.log('Markdown 消息已发送');
  }

  if (content === 'help') {
    await client.sendC2CMessage({
      openid,
      content: `# 命令帮助

- **md** - 发送 Markdown 格式消息
- **help** - 显示此帮助

发送 \`md\` 来查看 Markdown 效果！`,
      msgId: event.id,
    });
  }
});

async function main() {
  await client.connect();
  console.log('Markdown 机器人已启动');
  console.log('发送 "md" 查看 Markdown 效果');
  process.stdin.resume();
}

main().catch(console.error);
