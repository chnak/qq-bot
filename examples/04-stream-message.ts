/**
 * 示例4: 流式消息（打字机效果）
 */

import { createQQBotClient, StreamSession } from '../src/index.js';

const client = createQQBotClient({
  appId: process.env.APP_ID || 'YOUR_APP_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
});

// 监听私聊消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;
  const content = event.content.trim();

  console.log(`收到消息: ${content}`);

  if (content === '流式') {
    // 创建流式会话
    const stream = new StreamSession(
      client as any, // 直接传入 client（需要内部 API 实例）
      openid,
      event.id,
      `stream_${Date.now()}`,
      {
        done: () => {
          console.log('流式消息发送完成');
        },
        error: (err) => {
          console.error('流式消息错误:', err);
        },
      }
    );

    // 分段发送内容
    const messages = [
      '第',
      '一',
      '条',
      '流',
      '式',
      '消',
      '息',
      '，',
      '会',
      '逐',
      '字',
      '显',
      '示',
      '！',
    ];

    console.log('开始发送流式消息...');

    for (const msg of messages) {
      await stream.write(msg);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await stream.done();
  }

  if (content === '流式2') {
    // 批量发送模式
    const stream = new StreamSession(
      client as any,
      openid,
      event.id,
      `stream_${Date.now()}`,
      {
        done: () => console.log('批量流式消息完成'),
        error: (err) => console.error('错误:', err),
      }
    );

    const chunks = [
      '第一段：这是一条测试消息。\n',
      '第二段：流式消息会逐步显示内容。\n',
      '第三段：效果就像打字机一样。',
    ];

    for (const chunk of chunks) {
      await stream.write(chunk);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await stream.done();
  }
});

async function main() {
  await client.connect();
  console.log('流式消息机器人已启动');
  console.log('发送 "流式" 测试逐字效果');
  console.log('发送 "流式2" 测试批量效果');
  process.stdin.resume();
}

main().catch(console.error);
