// 导入数据库配置
const db = require('../config/database');

class PointsHistory {
    /**
     * 创建积分历史记录
     * @param {Object} historyData 积分历史数据
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Object} 创建的历史记录
     */
    static async create(historyData, connection = null) {
        try {
            const { 
                user_id, 
                change_type, 
                points_change, 
                total_points_before, 
                total_points_after, 
                available_points_before, 
                available_points_after, 
                reason, 
                description, // 添加description字段支持
                related_id, 
                reference_id // 添加reference_id字段支持
            } = historyData;

            let result;
            // 根据错误信息，我们需要包含total_points_before字段
            // 我们使用historyData中的值，如果没有提供就使用0作为默认值
            
            // 验证连接对象的有效性
            if (connection && typeof connection === 'object' && connection.execute) {
                console.log('使用事务连接对象创建积分历史记录');
                // 使用连接对象执行查询（事务中）
                const queryResult = await connection.execute(
                    `INSERT INTO points_history 
                    (user_id, change_type, points_change, total_points_before, total_points_after, created_at) 
                    VALUES (?, ?, ?, ?, ?, NOW())`,
                    [
                        user_id, 
                        change_type, 
                        points_change,
                        total_points_before || 0,
                        total_points_after || 0
                    ]
                );
                result = queryResult[0]; // connection.execute返回[result, fields]
            } else {
                console.log('使用默认数据库连接创建积分历史记录');
                // 使用默认数据库连接执行查询
                const queryResult = await db.query(
                    `INSERT INTO points_history 
                    (user_id, change_type, points_change, total_points_before, total_points_after, created_at) 
                    VALUES (?, ?, ?, ?, ?, NOW())`,
                    [
                        user_id, 
                        change_type, 
                        points_change,
                        total_points_before || 0,
                        total_points_after || 0
                    ]
                );
                result = queryResult; // db.query直接返回result
            }

            return {
                id: result.insertId,
                ...historyData,
                created_at: new Date()
            };
        } catch (error) {
            console.error('创建积分历史记录失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户积分历史记录
     * @param {number} userId 用户ID
     * @param {Object} options 查询选项
     * @param {number} options.page 页码
     * @param {number} options.pageSize 每页数量
     * @param {string} options.changeType 变更类型筛选
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Object} 历史记录列表和总数
     */
    static async findByUserId(userId, options = {}, connection = null) {
        try {
            const queryMethod = connection ? connection.execute : db.query;
            
            const page = parseInt(options.page) || 1;
            const pageSize = parseInt(options.pageSize) || 20;
            const offset = (page - 1) * pageSize;
            
            let whereClause = 'WHERE user_id = ?';
            let params = [userId];
            
            // 按变更类型筛选
            if (options.changeType) {
                whereClause += ' AND change_type = ?';
                params.push(options.changeType);
            }
            
            // 查询记录列表
            const [records] = await queryMethod(
                `SELECT * FROM points_history 
                ${whereClause} 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?`,
                [...params, pageSize, offset]
            );
            
            // 查询总数
            const [countResult] = await queryMethod(
                `SELECT COUNT(*) as total FROM points_history ${whereClause}`,
                params
            );
            
            return {
                records,
                total: countResult[0].total,
                page,
                pageSize,
                totalPages: Math.ceil(countResult[0].total / pageSize)
            };
        } catch (error) {
            console.error('获取积分历史记录失败:', error);
            throw error;
        }
    }

    /**
     * 获取积分历史记录详情
     * @param {number} id 历史记录ID
     * @returns {Object|null} 历史记录详情
     */
    static async findById(id) {
        try {
            const rows = await db.query(
                'SELECT * FROM points_history WHERE id = ?',
                [id]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('获取积分历史记录详情失败:', error);
            throw error;
        }
    }

    /**
     * 获取积分统计信息
     * @param {number} userId 用户ID
     * @returns {Object} 积分统计数据
     */
    static async getStatistics(userId) {
        try {
            const result = await db.query(
                `SELECT 
                    SUM(CASE WHEN change_type = 'earn' THEN points_change ELSE 0 END) as total_earned,
                    SUM(CASE WHEN change_type = 'spend' THEN points_change ELSE 0 END) as total_spent,
                    SUM(CASE WHEN change_type = 'expire' THEN points_change ELSE 0 END) as total_expired
                FROM points_history 
                WHERE user_id = ?`,
                [userId]
            );
            
            return result[0];
        } catch (error) {
            console.error('获取积分统计信息失败:', error);
            throw error;
        }
    }
}

module.exports = PointsHistory;