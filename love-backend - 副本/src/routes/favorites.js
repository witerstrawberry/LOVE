const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken } = require('../middleware/auth');

// 所有收藏相关的路由都需要用户登录
router.use(authenticateToken);

// 添加商家到收藏
router.post('/', favoriteController.addFavorite);

// 取消收藏商家
router.delete('/:merchantId', favoriteController.removeFavorite);

// 获取用户的收藏列表
router.get('/', favoriteController.getUserFavorites);

// 检查商家是否已收藏
router.get('/check/:merchantId', favoriteController.checkFavoriteStatus);

module.exports = router;