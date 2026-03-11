const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

/**
 * @route POST /api/ai/dish-recommendations
 * @description 获取AI推荐的菜品列表
 * @access 需要认证
 */
router.post('/dish-recommendations', aiController.getDishRecommendations);

/**
 * @route GET /api/ai/nutrition-advice/:userId
 * @description 获取个性化营养建议
 * @access 需要认证
 */
router.get('/nutrition-advice/:userId', aiController.getNutritionAdvice);

/**
 * @route POST /api/ai/personalized-menu
 * @description 获取个性化一周菜单
 * @access 需要认证
 */
router.post('/personalized-menu', aiController.getPersonalizedMenu);

module.exports = router;