const db = require('../config/database');

class Cart {
    /**
     * 添加商品到购物车
     * @param {number} userId 用户ID
     * @param {number} productId 商品ID
     * @param {number} quantity 数量
     * @returns {Object} 操作结果
     */
    static async addItem(userId, productId, quantity = 1) {
        try {
            // 检查商品是否存在且状态为active，同时获取merchant_id
            const [productRows] = await db.execute(
                'SELECT id, name, price, merchant_id FROM products WHERE id = ? AND status = "active"',
                [productId]
            );

            if (productRows.length === 0) {
                throw new Error('商品不存在或已下架');
            }

            const merchantId = productRows[0].merchant_id;
            if (!merchantId) {
                throw new Error('商品缺少商家信息');
            }

            // 检查购物车中是否已存在该商品
            const [existingRows] = await db.execute(
                'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
                [userId, productId]
            );

            if (existingRows.length > 0) {
                // 更新数量
                const newQuantity = existingRows[0].quantity + quantity;
                await db.execute(
                    'UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [newQuantity, existingRows[0].id]
                );
                return { success: true, message: '购物车商品数量已更新' };
            } else {
                // 添加新商品，包含merchant_id
                await db.execute(
                    'INSERT INTO cart (user_id, product_id, merchant_id, quantity) VALUES (?, ?, ?, ?)',
                    [userId, productId, merchantId, quantity]
                );
                return { success: true, message: '商品已添加到购物车' };
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * 获取用户购物车列表
     * @param {number} userId 用户ID
     * @returns {Array} 购物车商品列表
     */
    static async getCartItems(userId) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    c.id as cart_id,
                    c.quantity,
                    c.created_at as cart_created_at,
                    p.id as product_id,
                    p.category_id,
                    p.name,
                    p.description,
                    p.price,
                    p.image_url,
                    p.status,
                    p.sort_order,
                    p.view_count,
                    (p.price * c.quantity) as subtotal
                FROM cart c
                JOIN products p ON c.product_id = p.id
                WHERE c.user_id = ?
                ORDER BY c.created_at DESC
            `, [userId]);

            return rows;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 更新购物车商品数量
     * @param {number} userId 用户ID
     * @param {number} productId 商品ID
     * @param {number} quantity 新数量
     * @returns {Object} 操作结果
     */
    static async updateQuantity(userId, productId, quantity) {
        try {
            if (quantity <= 0) {
                // 数量为0或负数时删除商品
                return await this.removeItem(userId, productId);
            }

            const [result] = await db.execute(
                'UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?',
                [quantity, userId, productId]
            );

            if (result.affectedRows === 0) {
                throw new Error('购物车中未找到该商品');
            }

            return { success: true, message: '商品数量已更新' };
        } catch (error) {
            throw error;
        }
    }

    /**
     * 从购物车删除商品
     * @param {number} userId 用户ID
     * @param {number} productId 商品ID
     * @returns {Object} 操作结果
     */
    static async removeItem(userId, productId) {
        try {
            const [result] = await db.execute(
                'DELETE FROM cart WHERE user_id = ? AND product_id = ?',
                [userId, productId]
            );

            if (result.affectedRows === 0) {
                throw new Error('购物车中未找到该商品');
            }

            return { success: true, message: '商品已从购物车删除' };
        } catch (error) {
            throw error;
        }
    }

    /**
     * 清空用户购物车
     * @param {number} userId 用户ID
     * @returns {Object} 操作结果
     */
    static async clearCart(userId) {
        try {
            await db.execute('DELETE FROM cart WHERE user_id = ?', [userId]);
            return { success: true, message: '购物车已清空' };
        } catch (error) {
            throw error;
        }
    }

    /**
     * 获取购物车商品总数
     * @param {number} userId 用户ID
     * @returns {number} 商品总数
     */
    static async getCartCount(userId) {
        try {
            const [rows] = await db.execute(
                'SELECT SUM(quantity) as total_count FROM cart WHERE user_id = ?',
                [userId]
            );
            return rows[0].total_count || 0;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 获取购物车总金额
     * @param {number} userId 用户ID
     * @returns {number} 总金额
     */
    static async getCartTotal(userId) {
        try {
            const [rows] = await db.execute(`
                SELECT SUM(p.price * c.quantity) as total_amount
                FROM cart c
                JOIN products p ON c.product_id = p.id
                WHERE c.user_id = ? AND p.status = 'active'
            `, [userId]);
            return parseFloat(rows[0].total_amount) || 0;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Cart;