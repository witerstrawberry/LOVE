// 导入数据库配置
const db = require('../config/database');

class UserPoints {
    /**
     * 根据用户ID获取积分信息
     * @param {number} userId 用户ID
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Object|null} 积分信息
     */
    static async findByUserId(userId, connection = null) {
        try {
            console.log('=== 开始查找用户积分 ===');
            console.log('用户ID:', userId);
            console.log('是否使用事务连接:', !!connection);
            
            const sql = 'SELECT * FROM user_points WHERE user_id = ?';
            const params = [userId];
            console.log('执行SQL:', sql);
            console.log('SQL参数:', params);
            
            let result, rows;
            if (connection) {
                console.log('使用连接对象执行查询');
                [rows] = await connection.execute(sql, params);
            } else {
                console.log('使用db.query执行查询');
                rows = await db.query(sql, params);
            }
            
            console.log('查询结果行数:', rows.length);
            console.log('查询结果:', rows);
            
            const userPoints = rows[0] || null;
            console.log('返回的用户积分:', userPoints);
            console.log('=== 查找用户积分结束 ===');
            return userPoints;
        } catch (error) {
            console.error('查找用户积分失败:', error);
            console.error('错误类型:', typeof error);
            console.error('错误信息:', error.message);
            console.error('错误堆栈:', error.stack);
            throw error;
        }
    }

    /**
     * 创建用户积分记录
     * @param {number} userId 用户ID
     * @param {number} points 初始积分
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Object} 积分信息
     */
    static async create(userId, points = 0, connection = null) {
        try {
            console.log('=== 开始创建用户积分记录 ===');
            console.log('用户ID:', userId, '初始积分:', points);
            console.log('是否使用事务连接:', !!connection);
            
            const queryMethod = connection ? connection.execute : db.query;
            console.log('使用的查询方法:', connection ? 'connection.execute' : 'db.query');
            
            // 先检查是否已存在积分记录
            const existingPoints = await this.findByUserId(userId, connection);
            console.log('检查是否存在积分记录:', existingPoints ? '已存在' : '不存在');
            
            if (existingPoints) {
                console.log('用户已存在积分记录，直接返回现有记录');
                return existingPoints;
            }
            
            const sql = `INSERT INTO user_points (user_id, total_points, available_points)
                         VALUES (?, ?, ?)`;
            const params = [userId, points, points];
            console.log('执行SQL:', sql);
            console.log('SQL参数:', params);
            
            const result = await queryMethod(sql, params);
            
            // 兼容两种返回格式
            const insertResult = Array.isArray(result) ? result[0] : result;
            console.log('插入结果:', insertResult);
            
            const createdPoints = {
                id: insertResult.insertId,
                user_id: userId,
                total_points: points,
                available_points: points,
                expired_points: 0
            };
            
            console.log('积分记录创建成功:', createdPoints);
            console.log('=== 创建用户积分记录结束 ===');
            return createdPoints;
        } catch (error) {
            console.error('创建用户积分记录失败:', error);
            console.error('错误类型:', typeof error);
            console.error('错误信息:', error.message);
            console.error('错误堆栈:', error.stack);
            throw error;
        }
    }

    /**
     * 更新用户积分
     * @param {number} userId 用户ID
     * @param {number} pointsChange 积分变化量
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {boolean} 更新是否成功
     */
    static async updatePoints(userId, pointsChange, connection = null) {
        try {
            const queryMethod = connection ? connection.execute : db.query;
            
            // 先获取当前积分
            const currentPoints = await this.findByUserId(userId, connection);
            
            if (!currentPoints) {
                throw new Error('用户积分记录不存在');
            }
            
            // 计算新积分
            const newTotalPoints = currentPoints.total_points + pointsChange;
            const newAvailablePoints = currentPoints.available_points + pointsChange;
            
            // 确保积分不为负数
            const finalAvailablePoints = Math.max(0, newAvailablePoints);
            
            // 更新积分
            const [result] = await queryMethod(
                `UPDATE user_points 
                 SET total_points = ?, available_points = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [newTotalPoints, finalAvailablePoints, userId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新用户积分失败:', error);
            throw error;
        }
    }

    /**
     * 使用积分
     * @param {number} userId 用户ID
     * @param {number} points 要使用的积分数量
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Object} 更新后的积分信息
     */
    static async usePoints(userId, points, connection = null) {
        let transactionConnection = connection;
        let shouldRelease = false;
        
        try {
            console.log('=== 开始使用积分 ===');
            console.log('用户ID:', userId);
            console.log('使用积分数量:', points);
            console.log('是否使用事务连接:', !!connection);
            
            // 验证外部传入的连接对象是否有效
            if (connection) {
                console.log('使用外部传入的事务连接');
                // 不修改外部连接对象，只进行引用
                if (!connection.execute) {
                    throw new Error('传入的连接对象无效，缺少execute方法');
                }
            } else {
                // 如果没有提供连接，则创建一个新的事务连接
                console.log('未提供连接，创建新的事务连接');
                transactionConnection = await db.getConnection();
                await transactionConnection.beginTransaction();
                shouldRelease = true;
            }
            
            // 查询当前积分
            console.log('查询当前积分');
            const currentPoints = await this.findByUserId(userId, transactionConnection);
            
            if (!currentPoints) {
                console.log('用户积分记录不存在');
                if (shouldRelease && transactionConnection) {
                    await transactionConnection.rollback();
                    transactionConnection.release();
                }
                throw new Error('用户积分记录不存在');
            }
            
            console.log('当前可用积分:', currentPoints.available_points);
            
            // 检查积分是否足够
            if (currentPoints.available_points < points) {
                console.log('积分不足，当前可用积分:', currentPoints.available_points, '需要积分:', points);
                if (shouldRelease && transactionConnection) {
                    await transactionConnection.rollback();
                    transactionConnection.release();
                }
                const error = new Error('积分不足');
                error.code = 'INSUFFICIENT_POINTS';
                throw error;
            }
            
            // 更新积分
            console.log('更新积分');
            const newAvailablePoints = currentPoints.available_points - points;
            const newTotalPoints = currentPoints.total_points - points;
            
            console.log('新的可用积分:', newAvailablePoints);
            console.log('新的总积分:', newTotalPoints);
            
            const updateSql = 'UPDATE user_points SET available_points = ?, total_points = ?, updated_at = NOW() WHERE user_id = ?';
            const updateParams = [newAvailablePoints, newTotalPoints, userId];
            console.log('执行更新SQL:', updateSql);
            console.log('更新参数:', updateParams);
            
            await transactionConnection.execute(updateSql, updateParams);
            
            // 只在自己创建的事务中提交，不提交外部传入的事务
            if (shouldRelease && transactionConnection) {
                console.log('提交事务');
                await transactionConnection.commit();
                transactionConnection.release();
            }
            
            // 不要在事务中查询更新后的积分，直接返回计算后的结果
            console.log('积分更新成功');
            console.log('新的可用积分:', newAvailablePoints);
            console.log('新的总积分:', newTotalPoints);
            console.log('=== 使用积分结束 ===');
            
            // 直接返回计算后的积分信息，而不是再次查询数据库
            // 这样可以确保返回的是准确的更新后积分
            return {
                success: true,
                remainingPoints: newAvailablePoints,
                totalPoints: newTotalPoints,
                userPoints: {
                    ...currentPoints,
                    available_points: newAvailablePoints,
                    total_points: newTotalPoints,
                    updated_at: new Date()
                }
            };
        } catch (error) {
            console.error('使用积分失败:', error);
            console.error('错误类型:', typeof error);
            console.error('错误信息:', error.message);
            console.error('错误堆栈:', error.stack);
            
            // 回滚事务（如果是在独立事务中）
            if (transactionConnection && shouldRelease) {
                try {
                    await transactionConnection.rollback();
                    transactionConnection.release();
                } catch (rollbackError) {
                    console.error('回滚事务失败:', rollbackError);
                }
            }
            
            throw error;
        } finally {
            // 确保在错误情况下不会影响外部连接
            if (connection) {
                console.log('使用积分操作完成，保留外部事务连接');
            }
        }
        // 移除了多余的finally块，因为catch块已经处理了连接释放
    }

    /**
     * 返还积分（用于退款等情况）
     * @param {number} userId 用户ID
     * @param {number} points 返还的积分数量
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Object} 返还结果
     */
    static async addPoints(userId, points, connection = null) {
        let transactionConnection = connection;
        let shouldRelease = false;
        
        try {
            console.log('=== 开始返还积分 ===');
            console.log('用户ID:', userId);
            console.log('返还积分:', points);
            console.log('是否使用事务连接:', !!connection);
            
            // 如果没有提供连接，创建一个新的事务连接
            if (!transactionConnection) {
                transactionConnection = await db.getConnection();
                await transactionConnection.beginTransaction();
                shouldRelease = true;
                console.log('创建新的事务连接');
            }
            
            // 获取当前积分
            const currentPoints = await this.findByUserId(userId, transactionConnection);
            
            if (!currentPoints) {
                throw new Error('用户积分记录不存在');
            }
            
            console.log('当前可用积分:', currentPoints.available_points);
            console.log('当前总积分:', currentPoints.total_points);
            
            // 更新积分（增加）
            const newAvailablePoints = currentPoints.available_points + points;
            const newTotalPoints = currentPoints.total_points + points;
            
            console.log('新的可用积分:', newAvailablePoints);
            console.log('新的总积分:', newTotalPoints);
            
            const updateSql = 'UPDATE user_points SET available_points = ?, total_points = ?, updated_at = NOW() WHERE user_id = ?';
            const updateParams = [newAvailablePoints, newTotalPoints, userId];
            console.log('执行更新SQL:', updateSql);
            console.log('更新参数:', updateParams);
            
            await transactionConnection.execute(updateSql, updateParams);
            
            // 只在自己创建的事务中提交，不提交外部传入的事务
            if (shouldRelease && transactionConnection) {
                console.log('提交事务');
                await transactionConnection.commit();
                transactionConnection.release();
            }
            
            console.log('积分返还成功');
            console.log('新的可用积分:', newAvailablePoints);
            console.log('新的总积分:', newTotalPoints);
            console.log('=== 返还积分结束 ===');
            
            return {
                success: true,
                remainingPoints: newAvailablePoints,
                totalPoints: newTotalPoints,
                userPoints: {
                    ...currentPoints,
                    available_points: newAvailablePoints,
                    total_points: newTotalPoints,
                    updated_at: new Date()
                }
            };
        } catch (error) {
            console.error('返还积分失败:', error);
            console.error('错误类型:', typeof error);
            console.error('错误信息:', error.message);
            console.error('错误堆栈:', error.stack);
            
            // 回滚事务（如果是在独立事务中）
            if (transactionConnection && shouldRelease) {
                try {
                    await transactionConnection.rollback();
                    transactionConnection.release();
                } catch (rollbackError) {
                    console.error('回滚事务失败:', rollbackError);
                }
            }
            
            throw error;
        } finally {
            // 确保在错误情况下不会影响外部连接
            if (connection) {
                console.log('返还积分操作完成，保留外部事务连接');
            }
        }
    }
}

module.exports = UserPoints;