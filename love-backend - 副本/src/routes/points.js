const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// 使用积分支付
router.post('/pay', authenticateToken, pointsController.payWithPoints);

// 获取用户积分信息
router.get('/info', authenticateToken, pointsController.getUserPoints);

// 获取积分历史记录
router.get('/history', authenticateToken, pointsController.getPointsHistory);

// 获取用户积分详情 - 支持通过查询参数指定userId
router.get('/details', authenticateToken, pointsController.getPointsDetails);

// 获取用户积分余额
router.get('/balance', authenticateToken, pointsController.getUserPointsBalance);

module.exports = router;