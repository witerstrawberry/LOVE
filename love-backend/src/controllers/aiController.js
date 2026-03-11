const { callDeepSeekChat } = require('../services/deepseekService');
const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');

// 日志写入函数
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // 输出到控制台
  console.log(logMessage);
  
  // 同时写入日志文件
  const logFilePath = path.join(__dirname, '..', '..', 'debug.log');
  fs.appendFile(logFilePath, logMessage, 'utf8', (err) => {
    if (err) {
      console.error('写入日志文件失败:', err);
    }
  });
}

/**
 * 获取菜品推荐
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
async function getDishRecommendations(req, res) {
  try {
    writeLog('开始处理菜品推荐请求');
    
    // 1. 获取请求参数
    const { userInfo = {}, nutritionNeeds = [], preferences = [], currentDate } = req.body;
    writeLog(`用户营养需求: ${JSON.stringify(nutritionNeeds)}`);
    writeLog(`用户偏好: ${JSON.stringify(preferences)}`);
    
    // 2. 获取所有可用的产品列表（包括active和sold_out状态）
    // 不使用模拟数据，确保使用真实数据
    const products = await Product.getList(1, 100, { status: ['active', 'sold_out'] });
    const productList = products.products || [];
    writeLog(`获取到 ${productList.length} 个产品`);
    
    // 3. 如果没有产品数据，返回空列表而不是模拟数据
    if (productList.length === 0) {
      writeLog('产品列表为空，返回空结果');
      return res.json({
        success: true,
        dishes: [],
        nutritionTip: '暂无可用产品数据',
        timestamp: new Date().toISOString(),
        message: '暂无可用产品数据'
      });
    }
    
    // 获取当前天气信息
    const weatherInfo = req.body.weatherInfo || {};
    
    // 4. 构建提示词，让DeepSeek AI基于产品列表、用户需求、天气和节气生成推荐
    const prompt = `
你是一个专业的老年营养顾问，需要根据用户的健康需求、偏好、当前天气和节气，从提供的菜品列表中推荐最适合的选项。

用户信息：
${JSON.stringify(userInfo, null, 2)}

用户营养需求：${nutritionNeeds.join('、')}

用户饮食偏好：${preferences.length > 0 ? preferences.join('、') : '无特殊偏好'}

当前日期：${currentDate || new Date().toISOString()}

天气信息：${weatherInfo.description || '无天气信息'}，温度：${weatherInfo.temperature || '无温度信息'}

可用菜品列表：
${productList.map(p => `- ${p.name}: ${p.description || '无描述'}, 价格: ${p.price}元`).join('\n')}

请从以上菜品列表中，选择最适合老年人的4-6个菜品，考虑营养均衡、易于消化、适合老年人咀嚼等因素。

请按以下JSON格式返回推荐结果：
{
  "recommendations": [
    {
      "id": "菜品ID",
      "name": "菜品名称",
      "reason": "推荐理由",
      "nutritionBenefits": "营养益处"
    }
  ],
  "nutritionTip": "请以小辈向长辈关心叮嘱的温和语气，结合当前节气、天气温度等实际情况，提供贴心、温暖的饮食建议。语气要亲切自然，就像家人在耳边轻声提醒。内容简短温馨，不超过50字。例如：'爷爷/奶奶，最近天气热了，出门记得带杯水，今天做些清淡的汤品吧，这样身体舒服些~'"
}

请确保返回的id必须与提供的菜品列表中的id完全匹配。

**重要要求：请直接返回JSON对象，无需添加任何代码块标记或解释文字。确保返回的内容是纯JSON格式，可直接被JSON.parse解析。**
`;
    
    // 4. 调用DeepSeek AI获取推荐
    writeLog('调用DeepSeek AI生成推荐');
    const aiResponse = await callDeepSeekChat(prompt);
    writeLog(`AI返回结果: ${aiResponse}`);
    
    // 5. 解析AI返回的JSON
    let parsedResponse;
    let cleanResponse = aiResponse;
    
    // 日志记录原始响应内容
    writeLog(`原始AI响应: ${aiResponse.substring(0, 200)}...`);
    
    try {
      // 首先尝试移除可能存在的```json标记和前后空格
      cleanResponse = cleanResponse.replace(/^```json|```$/g, '').trim();
      writeLog(`清理后响应: ${cleanResponse.substring(0, 200)}...`);
      
      // 尝试解析清理后的响应
      parsedResponse = JSON.parse(cleanResponse);
    } catch (e) {
      // 如果清理后仍解析失败，尝试提取JSON部分
      writeLog('直接解析JSON失败，尝试提取JSON部分');
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          writeLog(`提取后解析失败: ${parseError.message}`);
          throw new Error('无法从AI响应中解析有效JSON');
        }
      } else {
        throw new Error('无法从AI响应中提取有效JSON');
      }
    }
    
    writeLog('JSON解析成功');
    
    // 6. 将推荐结果与实际产品信息合并
    const recommendedDishes = parsedResponse.recommendations.map(rec => {
      const product = productList.find(p => p.id == rec.id);
      return {
        id: rec.id,
        name: rec.name,
        description: product?.description || rec.reason,
        price: product?.price || 0,
        image: product?.image_url || '/images/default-dish.png',
        nutritionBenefits: rec.nutritionBenefits,
        reason: rec.reason
      };
    });
    
    // 7. 返回结果
    const result = {
      success: true,
      dishes: recommendedDishes,
      nutritionTip: parsedResponse.nutritionTip || '今天的推荐菜品注重营养均衡，适合您的健康需求。',
      timestamp: new Date().toISOString()
    };
    
    writeLog('菜品推荐请求处理完成');
    res.json(result);
  } catch (error) {
    writeLog(`菜品推荐请求处理失败: ${error.message}`);
    console.error('菜品推荐失败:', error);
    
    // 不使用模拟数据，直接返回错误信息
    res.status(500).json({
      success: false,
      message: '获取菜品推荐失败',
      error: error.message
    });
  }
}

/**
 * 获取营养建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
async function getNutritionAdvice(req, res) {
  try {
    const { userId } = req.params;
    
    // 构建提示词
    const prompt = `
你是一个专业的老年营养顾问，请提供一些适合老年人的通用营养建议，包括：
1. 日常饮食的注意事项
2. 适合老年人的食物种类
3. 饮食搭配原则
4. 常见健康问题的饮食调理建议

请用简洁易懂的语言回答，避免使用专业术语。`;
    
    // 调用DeepSeek AI
    const advice = await callDeepSeekChat(prompt);
    
    res.json({
      success: true,
      advice,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取营养建议失败:', error);
    res.status(500).json({
      success: false,
      message: '获取营养建议失败',
      error: error.message
    });
  }
}

/**
 * 获取个性化菜单
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
async function getPersonalizedMenu(req, res) {
  try {
    const { userInfo, healthConditions, preferences } = req.body;
    
    // 构建提示词
    const prompt = `
请为一位老年人设计一周的个性化菜单。

用户信息：
${JSON.stringify(userInfo, null, 2)}

健康状况：${healthConditions ? JSON.stringify(healthConditions, null, 2) : '无特殊健康问题'}

饮食偏好：${preferences ? preferences.join('、') : '无特殊偏好'}

请提供一周的菜单，每天包括早餐、午餐和晚餐，并说明每道菜的营养价值和适合老年人的原因。`;
    
    // 调用DeepSeek AI
    const menu = await callDeepSeekChat(prompt);
    
    res.json({
      success: true,
      menu,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取个性化菜单失败:', error);
    res.status(500).json({
      success: false,
      message: '获取个性化菜单失败',
      error: error.message
    });
  }
}

module.exports = {
  getDishRecommendations,
  getNutritionAdvice,
  getPersonalizedMenu
};