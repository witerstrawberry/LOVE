const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

// 所有通知接口均需要商家登录
router.use(authMiddleware.authenticateToken);

// 获取通知列表
router.get('/', notificationController.getNotifications);

// 获取志愿者通知
router.get('/volunteer', notificationController.getVolunteerNotifications);

// 创建通知
router.post('/', notificationController.createNotification);

// 更新通知
router.put('/:id', notificationController.updateNotification);

// 删除通知
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;

