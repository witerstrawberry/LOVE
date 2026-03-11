// 导入所需的模块
const express = require('express');
const router = express.Router();
const VolunteerController = require('../controllers/volunteerController');
const authMiddleware = require('../middleware/auth');

// 公开路由 - 暂时不需要

// 需要登录的路由 - 使用认证中间件
router.use(authMiddleware.authenticateToken);

/**
 * @route POST /api/volunteer/certification
 * @description 提交志愿者认证信息
 * @access 需要认证
 */
router.post('/certification', async (req, res) => {
    try {
        await VolunteerController.submitCertification(req, res);
    } catch (error) {
        console.error('提交志愿者认证失败:', error);
        res.status(500).json({
            success: false,
            message: '提交认证失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/volunteer/certification/status
 * @description 获取志愿者认证状态
 * @access 需要认证
 */
router.get('/certification/status', async (req, res) => {
    try {
        await VolunteerController.getCertificationStatus(req, res);
    } catch (error) {
        console.error('获取认证状态失败:', error);
        res.status(500).json({
            success: false,
            message: '获取认证状态失败',
            error: error.message
        });
    }
});

/**
 * @route PUT /api/volunteer/certification
 * @description 更新志愿者认证信息（仅在未审核或审核失败时可更新）
 * @access 需要认证
 */
router.put('/certification', async (req, res) => {
    try {
        await VolunteerController.updateCertification(req, res);
    } catch (error) {
        console.error('更新志愿者认证失败:', error);
        res.status(500).json({
            success: false,
            message: '更新认证失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/volunteer/profile
 * @description 获取志愿者个人资料
 * @access 需要认证
 */
router.get('/profile', async (req, res) => {
    try {
        await VolunteerController.getVolunteerProfile(req, res);
    } catch (error) {
        console.error('获取志愿者资料失败:', error);
        res.status(500).json({
            success: false,
            message: '获取资料失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/volunteer/notifications
 * @description 获取志愿者通知列表
 * @access 需要认证
 */
router.get('/notifications', async (req, res) => {
    try {
        await VolunteerController.getVolunteerNotifications(req, res);
    } catch (error) {
        console.error('获取志愿者通知失败:', error);
        res.status(500).json({
            success: false,
            message: '获取志愿者通知失败',
            error: error.message
        });
    }
});

module.exports = router;