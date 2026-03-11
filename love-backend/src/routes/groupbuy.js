const express = require('express');
const router = express.Router();
const groupBuyController = require('../controllers/GroupBuyController');
const { authenticateToken } = require('../middleware/auth');

// 获取拼团活动列表
router.get('/activities', groupBuyController.getActivities);

// 获取进行中的拼团列表
router.get('/active', groupBuyController.getActiveGroupBuys);

// 发起拼团（需要登录）
router.post('/', authenticateToken, groupBuyController.createGroupBuy);

// 取消拼团（需要登录）
router.put('/:groupId/cancel', authenticateToken, groupBuyController.cancelGroupBuy);

// 加入拼团（需要登录）
router.post('/:groupId/join', authenticateToken, groupBuyController.joinGroupBuy);

// 退出拼团（需要登录）
router.delete('/:groupId/leave', authenticateToken, groupBuyController.leaveGroupBuy);

// 获取拼团详情
router.get('/:groupId', groupBuyController.getGroupBuyDetail);

// 获取用户参与的拼团列表（需要登录）
router.get('/user/list', authenticateToken, groupBuyController.getUserGroupBuys);

module.exports = router;