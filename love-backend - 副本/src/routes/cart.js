const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/auth');

// 所有购物车路由都需要用户认证
router.use(authenticateToken);

router.post('/', cartController.addToCart);


router.get('/', cartController.getCartItems);


router.put('/', cartController.updateCartItem);


router.delete('/:product_id', cartController.removeCartItem);


router.delete('/', cartController.clearCart);


router.get('/count', cartController.getCartCount);


router.get('/total', cartController.getCartTotal);

module.exports = router;