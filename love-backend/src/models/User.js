const db = require('../config/database');
const crypto = require('crypto');

class User {
    /**
     * 根据ID查找用户
     * @param {number} id 用户ID
     * @returns {Object|null} 用户信息
     */
    static async findById(id) {
        try {
            const rows = await db.query(
                'SELECT * FROM users WHERE id = ?',
                [id]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('查找用户失败:', error);
            throw error;
        }
    }

    /**
     * 根据手机号查找用户
     * @param {string} phone 手机号
     * @returns {Object|null} 用户信息
     */
    static async findByPhone(phone) {
        try {
            const rows = await db.query(
                'SELECT * FROM users WHERE phone = ?',
                [phone]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('根据手机号查找用户失败:', error);
            throw error;
        }
    }

    /**
     * 创建新用户
     * @param {Object} userData 用户数据
     * @returns {number} 新用户ID
     */
    static async create(userData) {
        try {
            // 只插入数据库表中存在的字段
            const { phone, password, nickname, avatar, role_id } = userData;
            
            const result = await db.query(
                `INSERT INTO users (phone, password, nickname, avatar_url, role_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                [phone, password, nickname, avatar, role_id || null]
            );
            
            return {
                id: result.insertId,
                phone,
                nickname,
                avatar_url: avatar,
                role_id: role_id || null
            };
        } catch (error) {
            console.error('创建用户失败:', error);
            console.error('错误详情:', error.message);
            console.error('SQL语句:', error.sql);
            throw error;
        }
    }

    /**
     * 更新用户信息
     * @param {number} id 用户ID
     * @param {Object} updateData 更新数据
     * @returns {boolean} 更新是否成功
     */
    static async update(id, updateData) {
        try {
            const fields = [];
            const values = [];

            // 动态构建更新字段
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    fields.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            });

            if (fields.length === 0) {
                return true; // 没有需要更新的字段
            }

            values.push(id);

            const result = await db.query(
                `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 更新最后登录时间
     * @param {number} id 用户ID
     * @returns {boolean} 更新是否成功
     */
    static async updateLastLogin(id) {
        try {
            const result = await db.query(
                'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新最后登录时间失败:', error);
            throw error;
        }
    }

    /**
     * 删除用户
     * @param {number} id 用户ID
     * @returns {boolean} 删除是否成功
     */
    static async delete(id) {
        try {
            const result = await db.query(
                'DELETE FROM users WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('删除用户失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户列表（分页）
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @param {Object} filters 筛选条件
     * @returns {Object} 用户列表和总数
     */
    static async getList(page = 1, limit = 10, filters = {}) {
        try {
            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 10;
            const offset = (pageNum - 1) * limitNum;
            let whereClause = 'WHERE 1=1';
            const params = [];

            // 构建筛选条件
            if (filters.status) {
                whereClause += ' AND status = ?';
                params.push(filters.status);
            }
            if (filters.phone) {
                whereClause += ' AND phone LIKE ?';
                params.push(`%${filters.phone}%`);
            }
            if (filters.nickname) {
                whereClause += ' AND nickname LIKE ?';
                params.push(`%${filters.nickname}%`);
            }

            // 获取总数
            const countRows = await db.query(
                `SELECT COUNT(*) as total FROM users ${whereClause}`,
                params
            );
            const total = countRows[0].total;

            // 获取用户列表（不包含密码） - 仅选择当前users表中存在的字段
            // 注意：为避免 MySQL2 对 LIMIT/OFFSET 预处理参数的兼容性问题，这里直接拼接整数
            const listSql = `
                SELECT 
                    id,
                    phone,
                    nickname,
                    avatar_url,
                    role_id,
                    status,
                    last_login_at,
                    created_at,
                    updated_at
                FROM users
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ${limitNum} OFFSET ${offset}
            `;
            // 由于SQL中已经直接拼接了LIMIT和OFFSET，且whereClause中的占位符已经被params填充，
            // 所以这里不需要再传递params数组给rawQuery方法
            const rows = await db.rawQuery(listSql);

            return {
                users: rows,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('获取用户列表失败:', error);
            throw error;
        }
    }

    /**
     * 创建用户会话
     * @param {number} userId 用户ID
     * @param {string} token JWT令牌
     * @param {string} deviceInfo 设备信息
     * @param {string} ipAddress IP地址
     * @returns {number} 会话ID
     */
    static async createSession(userId, token, deviceInfo = '', ipAddress = '') {
        try {
            // 生成token的hash值用于存储
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            
            // 计算过期时间（7天后）
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const result = await db.query(
                `INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, expires_at) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, tokenHash, deviceInfo, ipAddress, expiresAt]
            );

            return result.insertId;
        } catch (error) {
            console.error('创建用户会话失败:', error);
            throw error;
        }
    }

    /**
     * 删除用户会话
     * @param {number} userId 用户ID
     * @param {string} token JWT令牌
     * @returns {boolean} 删除是否成功
     */
    static async deleteSession(userId, token) {
        try {
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            
            const result = await db.query(
                'DELETE FROM user_sessions WHERE user_id = ? AND token_hash = ?',
                [userId, tokenHash]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('删除用户会话失败:', error);
            throw error;
        }
    }

    /**
     * 清理过期会话
     * @returns {number} 清理的会话数量
     */
    static async cleanExpiredSessions() {
        try {
            const result = await db.query(
                'DELETE FROM user_sessions WHERE expires_at < NOW()'
            );

            return result.affectedRows;
        } catch (error) {
            console.error('清理过期会话失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户活跃会话数量
     * @param {number} userId 用户ID
     * @returns {number} 活跃会话数量
     */
    static async getActiveSessionCount(userId) {
        try {
            const rows = await db.query(
                'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ? AND expires_at > NOW()',
                [userId]
            );

            return rows[0].count;
        } catch (error) {
            console.error('获取活跃会话数量失败:', error);
            throw error;
        }
    }
}

module.exports = User;