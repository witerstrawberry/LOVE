const express = require('express');
const router = express.Router();
const seckillController = require('../controllers/seckillController');
const { optionalAuth } = require('../middleware/auth');

// 为了确保兼容性，添加这个中间件来测试router是否正常工作
router.use((req, res, next) => {
    console.log('秒杀路由中间件被调用:', req.path);
    next();
});

/**
 * 秒杀商品相关路由
 */

// 获取正在进行的秒杀商品
router.get('/active', optionalAuth, seckillController.getActiveSeckillProducts);

// 获取秒杀商品列表（支持分页和状态过滤）
router.get('/', optionalAuth, seckillController.getSeckillProducts);

// 获取秒杀商品详情
router.get('/:id', optionalAuth, seckillController.getSeckillProductById);

module.exports = router;