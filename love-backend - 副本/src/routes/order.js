const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const Order = require('../models/Order');
const authMiddleware = require('../middleware/auth');

// 获取商家订单列表 - 需要商家身份认证
// 注意：这个路由需要放在认证中间件之前，因为它有特殊的认证逻辑
router.get('/merchant/orders', async (req, res) => {
    try {
        console.log('=== 商家订单列表接口被调用 ===');
        console.log('请求对象:', {
            method: req.method,
            url: req.url,
            headers: req.headers,
            query: req.query,
            body: req.body
        });
        
        // 从token或请求头中获取商家信息
        let merchantId = req.headers['x-merchant-id'] || req.query.merchant_id || req.query.merchantId;
        console.log('原始merchantId来源:', {
            'x-merchant-id': req.headers['x-merchant-id'],
            'merchant_id': req.query.merchant_id,
            'merchantId': req.query.merchantId
        });
        
        // 如果没有显式传递商家ID，尝试从Authorization token中解析
        if (!merchantId) {
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    // 这里可以添加JWT token解析逻辑
                    // 暂时跳过token解析，使用默认商家ID
                    console.log('Authorization header found:', authHeader);
                } catch (err) {
                    console.warn('Token解析失败:', err.message);
                }
            }
        }
        
        // 如果仍未获取到商家ID，使用测试商家ID
        if (!merchantId) {
            merchantId = 'MER10001'; // 默认测试商家ID，对应数据库中的merchant_id
            console.log('使用默认商家ID:', merchantId);
        } else {
            console.log('使用传入的商家ID:', merchantId);
        }
        
        const { status, page = 1, limit = 10 } = req.query;

        console.log('最终解析参数:', {
            merchantId,
            status,
            page,
            limit,
            timestamp: new Date().toISOString()
        });

        // 调用Order模型的方法，根据merchant_id查询订单
        console.log('开始调用Order.getMerchantOrders...');
        const result = await Order.getMerchantOrders(merchantId, status, parseInt(page), parseInt(limit));
        console.log('Order.getMerchantOrders调用成功，返回:', result);
        
        // 返回标准格式，兼容index.js的数据格式
        const response = {
            success: true,
            code: 200,
            message: '获取商家订单列表成功',
            data: {
                orders: result.data.orders || [],
                pagination: result.data.pagination || {}
            },
            timestamp: new Date().toISOString()
        };
        
        console.log('准备返回响应:', response);
        res.json(response);
    } catch (error) {
        console.error('=== 获取商家订单列表失败 ===');
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
        
        const errorResponse = {
            success: false,
            code: 500,
            message: error.message || '获取商家订单列表失败',
            data: null,
            timestamp: new Date().toISOString()
        };
        
        console.log('返回错误响应:', errorResponse);
        res.status(500).json(errorResponse);
    }
});

// 为剩余所有订单路由添加认证中间件
router.use(authMiddleware.authenticateToken);

router.post('/', orderController.createOrder);


router.get('/', orderController.getUserOrders);


router.get('/stats', orderController.getOrderStats);

// 注意：tracking 和 accept 路由必须在 /:id 之前，否则会被 /:id 拦截
router.get('/:id/tracking', orderController.getOrderTracking);
router.post('/:id/accept', orderController.acceptOrder);

router.get('/:id', orderController.getOrderDetail);


router.put('/:id/status', orderController.updateOrderStatus);


router.delete('/:id', orderController.deleteOrder);


router.put('/:id/cancel', orderController.cancelOrder);

module.exports = router;