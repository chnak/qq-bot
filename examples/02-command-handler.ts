/**
 * 示例2: 命令处理器
 */

import { createQQBotClient } from '../src/index.js';

const client = createQQBotClient({
  appId: process.env.APP_ID || 'YOUR_APP_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
});

// 命令列表
const commands: Record<string, (openid: string) => Promise<void>> = {
  help: async (openid) => {
    await client.sendC2CMessage({
      openid,
      content: `可用命令：
1. help - 显示帮助
2. ping - 检查状态
3. hello - 打招呼
4. info - 机器人信息`,
    });
  },

  ping: async (openid) => {
    await client.sendC2CMessage({ openid, content: 'Pong! Bot is running.' });
  },

  hello: async (openid) => {
    await client.sendC2CMessage({ openid, content: 'Hello! I am QQ Bot SDK.' });
  },

  info: async (openid) => {
    await client.sendC2CMessage({
      openid,
      content: `# QQ Bot SDK

- 基于 QQ 开放平台 API v2
- 支持 WebSocket 长连接
- 支持消息发送和接收
- 支持图片、语音、视频、文件`,
    });
  },
};

// 监听私聊消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;
  const content = event.content.trim().toLowerCase();

  // 检查是否是命令
  const command = commands[content];
  if (command) {
    console.log(`执行命令: ${content}`);
    await command(openid);
  } else {
    console.log(`收到消息: ${content}`);
    await client.sendC2CMessage({
      openid,
      content: `未知命令 "${content}"，输入 "help" 查看可用命令`,
    });
  }
});

async function main() {
  await client.connect();
  console.log('命令处理器已启动');
  process.stdin.resume();
}

main().catch(console.error);
