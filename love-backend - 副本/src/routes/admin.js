const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// 所有管理员接口都需要登录且具备管理员角色
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireAdmin);

// 用户管理
router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);

// 商家管理
router.get('/merchants', adminController.getMerchants);
router.patch('/merchants/:id/status', adminController.updateMerchantStatus);

// 系统通知管理
router.post('/notifications/system', adminController.createSystemNotification);
router.delete('/notifications/system/:id', adminController.deleteSystemNotification);

module.exports = router;


