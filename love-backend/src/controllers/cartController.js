const Cart = require('../models/Cart');
const { success, error, badRequest, notFound } = require('../utils/response');

class CartController {
    /**
     * 添加商品到购物车
     */
    async addToCart(req, res) {
        try {
            const userId = req.user.id; // 从认证中间件获取用户ID
            const { product_id, quantity = 1 } = req.body;

            // 验证参数
            if (!product_id) {
                return badRequest(res, '商品ID不能为空');
            }

            const productIdNum = parseInt(product_id);
            const quantityNum = parseInt(quantity);

            if (isNaN(productIdNum) || productIdNum <= 0) {
                return badRequest(res, '商品ID格式不正确');
            }

            if (isNaN(quantityNum) || quantityNum <= 0) {
                return badRequest(res, '商品数量必须大于0');
            }

            const result = await Cart.addItem(userId, productIdNum, quantityNum);
            return success(res, result.message, null);

        } catch (err) {
            console.error('添加购物车失败:', err);
            return error(res, err.message || '添加购物车失败');
        }
    }

    /**
     * 获取购物车列表
     */
    async getCartItems(req, res) {
        try {
            const userId = req.user.id;
            
            const cartItems = await Cart.getCartItems(userId);
            const totalCount = await Cart.getCartCount(userId);
            const totalAmount = await Cart.getCartTotal(userId);

            return success(res, {
                items: cartItems,
                total_count: totalCount,
                total_amount: totalAmount
            }, '获取购物车成功');

        } catch (err) {
            console.error('获取购物车失败:', err);
            return error(res, '获取购物车失败');
        }
    }

    /**
     * 更新购物车商品数量
     */
    async updateCartItem(req, res) {
        try {
            const userId = req.user.id;
            const { product_id, quantity } = req.body;

            // 验证参数
            if (!product_id) {
                return badRequest(res, '商品ID不能为空');
            }

            const productIdNum = parseInt(product_id);
            const quantityNum = parseInt(quantity);

            if (isNaN(productIdNum) || productIdNum <= 0) {
                return badRequest(res, '商品ID格式不正确');
            }

            if (isNaN(quantityNum) || quantityNum < 0) {
                return badRequest(res, '商品数量格式不正确');
            }

            const result = await Cart.updateQuantity(userId, productIdNum, quantityNum);
            return success(res, result.message, null);

        } catch (err) {
            console.error('更新购物车失败:', err);
            return error(res, err.message || '更新购物车失败');
        }
    }

    /**
     * 删除购物车商品
     */
    async removeCartItem(req, res) {
        try {
            const userId = req.user.id;
            const { product_id } = req.params;

            const productIdNum = parseInt(product_id);
            if (isNaN(productIdNum) || productIdNum <= 0) {
                return badRequest(res, '商品ID格式不正确');
            }

            const result = await Cart.removeItem(userId, productIdNum);
            return success(res, result.message, null);

        } catch (err) {
            console.error('删除购物车商品失败:', err);
            return error(res, err.message || '删除购物车商品失败');
        }
    }

    /**
     * 清空购物车
     */
    async clearCart(req, res) {
        try {
            const userId = req.user.id;
            
            const result = await Cart.clearCart(userId);
            return success(res, result.message, null);

        } catch (err) {
            console.error('清空购物车失败:', err);
            return error(res, '清空购物车失败');
        }
    }

    /**
     * 获取购物车商品数量
     */
    async getCartCount(req, res) {
        try {
            const userId = req.user.id;
            
            const count = await Cart.getCartCount(userId);
            return success(res, '获取购物车数量成功', { count });

        } catch (err) {
            console.error('获取购物车数量失败:', err);
            return error(res, '获取购物车数量失败');
        }
    }

    /**
     * 获取购物车总金额
     */
    async getCartTotal(req, res) {
        try {
            const userId = req.user.id;
            
            const total = await Cart.getCartTotal(userId);
            return success(res, '获取购物车总金额成功', { total });

        } catch (err) {
            console.error('获取购物车总金额失败:', err);
            return error(res, '获取购物车总金额失败');
        }
    }
}

module.exports = new CartController();