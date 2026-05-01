/**
 * 示例1: 基础机器人 - 接收消息并回复
 */

import { createQQBotClient } from '../src/index.js';

const client = createQQBotClient({
  appId: process.env.APP_ID || 'YOUR_APP_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
});

// 监听私聊消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;
  const content = event.content.trim();

  console.log(`收到私聊消息: ${content} from ${openid}`);

  // 回复消息
  await client.sendC2CMessage({
    openid,
    content: `收到你的消息: ${content}`,
    msgId: event.id,
  });
});

// 监听群聊@消息
client.on('GROUP_AT_MESSAGE_CREATE', async (event) => {
  const content = event.content.trim();
  const groupOpenid = event.group_openid!;

  console.log(`收到群消息: ${content} from group ${groupOpenid}`);

  // 回复群消息
  await client.sendGroupMessage({
    groupOpenid,
    content: `收到群消息: ${content}`,
    msgId: event.id,
  });
});

// 启动连接
async function main() {
  await client.connect();
  console.log('机器人已启动，按 Ctrl+C 退出');
  process.stdin.resume();
}

main().catch(console.error);
