/**
 * 示例3: 发送本地文件和媒体
 */

import { createQQBotClient } from '../src/index.js';

const client = createQQBotClient({
  appId: process.env.APP_ID || 'YOUR_APP_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
});

// 监听私聊消息
client.on('C2C_MESSAGE_CREATE', async (event) => {
  const openid = event.author.user_openid;
  const content = event.content.trim().toLowerCase();

  console.log(`收到命令: ${content}`);

  if (content === '图片') {
    // 发送本地图片
    await client.sendC2CLocalImageMessage({
      openid,
      filePath: './test.png',
      content: '这是一张测试图片',
    });
    console.log('图片已发送');
  }

  if (content === '语音') {
    // 发送本地语音
    await client.sendC2CLocalVoiceMessage({
      openid,
      filePath: './voice.silk',
    });
    console.log('语音已发送');
  }

  if (content === '视频') {
    // 发送本地视频
    await client.sendC2CLocalVideoMessage({
      openid,
      filePath: './video.mp4',
      content: '这是一段测试视频',
    });
    console.log('视频已发送');
  }

  if (content === '文件') {
    // 发送本地文件
    await client.sendC2CLocalFileMessage({
      openid,
      filePath: './document.pdf',
      content: '这是一份测试文档',
    });
    console.log('文件已发送');
  }
});

async function main() {
  await client.connect();
  console.log('媒体发送机器人已启动');
  console.log('发送 "图片"、"语音"、"视频" 或 "文件" 来测试');
  process.stdin.resume();
}

main().catch(console.error);
