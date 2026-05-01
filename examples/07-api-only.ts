/**
 * 示例7: 仅使用 API 发送消息（不需要 WebSocket 连接）
 */

import { QQBotAPIClient } from '../src/index.js';

const api = new QQBotAPIClient({
  appId: process.env.APP_ID || 'YOUR_APP_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  markdownSupport: true,
});

async function main() {
  // 获取 token（用于验证配置是否正确）
  const token = await api.getToken();
  console.log('Token 获取成功:', token.substring(0, 20) + '...');

  // 获取网关 URL
  const gatewayUrl = await api.getGatewayUrl();
  console.log('Gateway URL:', gatewayUrl);

  // 发送目标 openid（需要用户先给机器人发消息获取）
  const targetOpenid = process.env.TARGET_OPENID || 'USER_OPENID';

  // 发送文本消息
  const textResult = await api.sendC2CMessage(targetOpenid, '这是一条测试消息！');
  console.log('文本消息发送成功:', textResult.id);

  // 发送 Markdown 消息
  const mdResult = await api.sendC2CMessage(
    targetOpenid,
    '# Hello\n\n这是一条 **Markdown** 消息！'
  );
  console.log('Markdown 消息发送成功:', mdResult.id);

  // 发送本地图片（需要先准备好图片文件）
  // const imageResult = await api.sendC2CLocalImageMessage(
  //   targetOpenid,
  //   './test.png',
  //   undefined,
  //   '图片描述'
  // );
  // console.log('图片消息发送成功:', imageResult.id);

  console.log('\n所有测试消息发送完成！');
}

main().catch(console.error);
