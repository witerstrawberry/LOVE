// 导入所需的模块
const express = require('express');
const MerchantController = require('../controllers/merchantController');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// 公开路由 - 获取商家列表（无需登录）
router.get('/list', async (req, res) => {
    try {
        await MerchantController.getMerchantList(req, res);
    } catch (error) {
        console.error('获取商家列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取商家列表失败',
            error: error.message
        });
    }
});

// 公开路由 - 检查商家信息是否完善（用于登录后弹窗判断）
router.get('/public/info', async (req, res) => {
    try {
        await MerchantController.getPublicMerchantInfo(req, res);
    } catch (error) {
        console.error('获取公开商家信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取公开商家信息失败',
            error: error.message
        });
    }
});

router.get('/public/check-info', async (req, res) => {
    try {
        const result = await MerchantController.publicCheckInfoStatus(req, res);
    } catch (error) {
        console.error('公开检查商家信息状态失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '公开检查商家信息状态失败',
            error: error.message 
        });
    }
});

// 需要登录的路由 - 使用认证中间件
router.use('/private', authMiddleware.authenticateToken);

// 私有路由 - 需要登录验证
// 获取商家信息
router.get('/private/info', async (req, res) => {
    try {
        const result = await MerchantController.getMerchantInfo(req, res);
    } catch (error) {
        console.error('获取商家信息失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取商家信息失败',
            error: error.message 
        });
    }
});

// 保存商家信息
router.post('/private/save', async (req, res) => {
    try {
        const result = await MerchantController.saveMerchantInfo(req, res);
    } catch (error) {
        console.error('保存商家信息失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '保存商家信息失败',
            error: error.message 
        });
    }
});

// 检查商家信息完善状态
router.get('/private/check-status', async (req, res) => {
    try {
        const result = await MerchantController.checkInfoStatus(req, res);
    } catch (error) {
        console.error('检查商家信息状态失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '检查商家信息状态失败',
            error: error.message 
        });
    }
});

// 更新营业状态
router.post('/private/business-status', async (req, res) => {
    try {
        const result = await MerchantController.updateBusinessStatus(req, res);
    } catch (error) {
        console.error('更新营业状态失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '更新营业状态失败',
            error: error.message 
        });
    }
});

// 获取营业状态
router.get('/private/business-status', async (req, res) => {
    try {
        const result = await MerchantController.getBusinessStatus(req, res);
    } catch (error) {
        console.error('获取营业状态失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取营业状态失败',
            error: error.message 
        });
    }
});

// 获取商家统计数据（今日订单和营收）
router.get('/private/stats', async (req, res) => {
    try {
        const result = await MerchantController.getMerchantStats(req, res);
    } catch (error) {
        console.error('获取商家统计失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取商家统计失败',
            error: error.message 
        });
    }
});

console.log('商家路由注册完成');

module.exports = router;