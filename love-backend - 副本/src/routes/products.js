const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalAuth } = require('../middleware/auth');

// 商品列表 - 公开访问
router.get('/', productController.getProducts);

// 添加商品 - 需要商家认证
router.post('/', optionalAuth, productController.createProduct);

// 更新商品
router.put('/:id', optionalAuth, productController.updateProduct);

// 删除商品
router.delete('/:id', optionalAuth, productController.deleteProduct);

// 商品分类列表
router.get('/category/:categoryId', productController.getProductsByCategory);

// 热门商品
router.get('/popular', productController.getPopularProducts);

// 搜索商品
router.get('/search', productController.searchProducts);

// 分类管理
router.get('/categories', productController.getCategories);
router.get('/categories/:id', productController.getCategoryWithProducts);

// 单个商品详情
router.get('/:id', productController.getProductById);

module.exports = router;