const db = require('../config/database');

class Favorite {
    /**
     * 添加商家到收藏
     * @param {number} userId 用户ID
     * @param {string} merchantId 商家ID
     * @returns {Object} 收藏信息
     */
    static async add(userId, merchantId) {
        try {
            const result = await db.query(
                'INSERT INTO favorites (user_id, merchant_id) VALUES (?, ?)',
                [userId, merchantId]
            );
            
            return {
                id: result.insertId,
                user_id: userId,
                merchant_id: merchantId,
                created_at: new Date()
            };
        } catch (error) {
            // 处理唯一约束冲突
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('该商家已经在您的收藏列表中');
            }
            console.error('添加收藏失败:', error);
            throw error;
        }
    }

    /**
     * 从收藏中删除商家
     * @param {number} userId 用户ID
     * @param {string} merchantId 商家ID
     * @returns {boolean} 删除是否成功
     */
    static async remove(userId, merchantId) {
        try {
            const result = await db.query(
                'DELETE FROM favorites WHERE user_id = ? AND merchant_id = ?',
                [userId, merchantId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('取消收藏失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户的收藏列表
     * @param {number} userId 用户ID
     * @param {number} page 页码，默认为1
     * @param {number} limit 每页数量，默认为10
     * @returns {Object} 收藏列表和分页信息
     */
    static async getListByUser(userId, page = 1, limit = 10) {
        try {
            // 验证用户ID
            if (!userId || isNaN(parseInt(userId))) {
                throw new Error('无效的用户ID');
            }
            
            // 确保参数类型正确
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const offset = (pageNum - 1) * limitNum;
            
            // 验证分页参数合理性
            if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
                throw new Error('分页参数不正确');
            }
            
            const intUserId = parseInt(userId);
            console.log(`执行SQL: 用户ID=${intUserId}, 每页数量=${limitNum}, 偏移量=${offset}`);
            
            // 使用rawQuery函数执行SQL查询，避免预处理语句的参数传递问题
            // 先查询总数
            const countResult = await db.rawQuery(
                'SELECT COUNT(*) as total FROM favorites WHERE user_id = ' + intUserId
            );
            const total = countResult[0].total;
            
            // 关联查询收藏列表和商家信息
            const rows = await db.rawQuery(
                `SELECT 
                    f.id as favorite_id, 
                    f.merchant_id, 
                    f.created_at as favorite_time,
                    m.name, 
                    m.logo,
                    m.rating,
                    m.address,
                    m.is_open
                FROM favorites f
                LEFT JOIN merchants m ON f.merchant_id = m.id
                WHERE f.user_id = ${intUserId} 
                ORDER BY f.created_at DESC 
                LIMIT ${limitNum} OFFSET ${offset}`
            );
            
            console.log(`查询结果:`, rows);
            
            // 如果查询成功，返回结果
            return {
                favorites: rows,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            };
        } catch (error) {
            console.error('获取收藏列表失败:', error);
            throw new Error('获取收藏数据失败: ' + error.message);
        }
    }

    /**
     * 检查商家是否已收藏
     * @param {number} userId 用户ID
     * @param {string} merchantId 商家ID
     * @returns {boolean} 是否已收藏
     */
    static async isFavorite(userId, merchantId) {
        try {
            const result = await db.query(
                'SELECT id FROM favorites WHERE user_id = ? AND merchant_id = ?',
                [userId, merchantId]
            );
            
            return result.length > 0;
        } catch (error) {
            console.error('检查收藏状态失败:', error);
            throw error;
        }
    }
}

module.exports = Favorite;