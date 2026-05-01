/**
 * 示例5: 群聊机器人
 */

import { createQQBotClient } from '../src/index.js';

const client = createQQBotClient({
  appId: process.env.APP_ID || 'YOUR_APP_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
});

// 监听群聊@消息
client.on('GROUP_AT_MESSAGE_CREATE', async (event) => {
  const content = event.content.trim();
  const groupOpenid = event.group_openid!;
  const username = event.author.username || '群友';

  console.log(`群消息 from ${username}: ${content}`);

  // 处理命令
  if (content === '你好' || content === '/hello') {
    await client.sendGroupMessage({
      groupOpenid,
      content: `你好 ${username}！`,
      msgId: event.id,
    });
  }

  if (content === '帮助' || content === '/help') {
    await client.sendGroupMessage({
      groupOpenid,
      content: `可用命令：
1. 你好 - 打招呼
2. 帮助 - 显示此帮助
3. @我 说任意话 - 我会复读`,
      msgId: event.id,
    });
  }

  // 简单复读功能
  if (content.includes('@Bot')) {
    const text = content.replace(/@Bot\s*/g, '').trim();
    if (text) {
      await client.sendGroupMessage({
        groupOpenid,
        content: text,
        msgId: event.id,
      });
    }
  }
});

async function main() {
  await client.connect();
  console.log('群聊机器人已启动');
  console.log('在群聊中 @机器人 并发送命令来测试');
  process.stdin.resume();
}

main().catch(console.error);
