const axios = require('axios');

// 配置 DeepSeek API（从环境变量读取API Key）
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/v1/chat/completions'; // 对话接口地址

/**
 * 调用 DeepSeek 对话接口
 * @param {string} prompt 用户输入的提示词
 * @returns {Promise<string>} AI 生成的回复内容
 */
async function callDeepSeekChat(prompt) {
  try {
    // 检查API Key是否存在
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API Key未配置');
    }

    const response = await axios.post(
      DEEPSEEK_CHAT_URL,
      {
        model: "deepseek-chat", // 模型名称
        messages: [
          { role: "user", content: prompt } // 用户消息
        ],
        temperature: 0.7, // 生成随机性（0-1，值越高越随机）
        max_tokens: 1024 // 最大生成token数
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}` // 认证方式
        }
      }
    );

    // 解析返回结果
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("DeepSeek API 调用失败：", error.response?.data || error.message);
    throw new Error("AI 接口调用异常，请稍后重试");
  }
}

module.exports = { callDeepSeekChat };