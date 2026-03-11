const express = require('express');
const router = express.Router();
const { callDeepSeekChat } = require('../services/deepseekService');

/**
 * @route POST /api/deepseek/chat
 * @description 接收前端的问题，返回 DeepSeek 的回答
 * @access 需要认证
 */
router.post('/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    // 验证请求参数
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({
        success: false,
        error: "请输入有效的提问内容"
      });
    }

    // 调用 DeepSeek AI
    const aiReply = await callDeepSeekChat(prompt.trim());
    
    // 返回成功结果
    res.json({
      success: true,
      reply: aiReply,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 错误处理
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
});

module.exports = router;