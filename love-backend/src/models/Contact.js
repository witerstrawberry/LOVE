// 联系人模型
const db = require('../config/database');

class Contact {
    /**
     * 创建新联系人
     * @param {Object} contactData 联系人数据
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Promise<Object>} 创建的联系人记录
     */
    static async create(contactData, connection = null) {
        const queryMethod = connection || db;
        const { elderly_user_id, contact_user_id, contact_role_id, relationship, is_primary, contact_phone } = contactData;
        
        // 如果设置为主要联系人，需要将其他联系人设为非主要
        if (is_primary) {
            await queryMethod.query(
                'UPDATE contacts SET is_primary = 0 WHERE elderly_user_id = ?',
                [elderly_user_id]
            );
        }
        
        const [result] = await queryMethod.query(
            `INSERT INTO contacts (elderly_user_id, contact_user_id, contact_role_id, relationship, is_primary, contact_phone) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [elderly_user_id, contact_user_id, contact_role_id, relationship, is_primary, contact_phone || null]
        );
        
        // 返回创建的联系人信息
        return this.findById(result.insertId, queryMethod);
    }
    
    /**
     * 根据ID查找联系人
     * @param {number} id 联系人ID
     * @param {Object} connection 可选的数据库连接对象
     * @returns {Promise<Object|null>} 联系人信息
     */
    static async findById(id, connection = null) {
        const queryMethod = connection || db;
        const [rows] = await queryMethod.query(
            `SELECT c.id, c.elderly_user_id, c.contact_user_id, c.contact_role_id, 
                    c.relationship, c.is_primary, c.created_at, c.updated_at, c.contact_phone,
                    IFNULL(cu.nickname, '未设置昵称') as contact_name, 
                    IFNULL(cu.phone, '未设置电话') as contact_user_phone, 
                    r.name as contact_role_name 
             FROM contacts c
             LEFT JOIN users cu ON c.contact_user_id = cu.id
             LEFT JOIN roles r ON c.contact_role_id = r.id
             WHERE c.id = ?`,
            [id]
        );
        return rows[0] || null;
    }
    
    /**
     * 根据老人用户ID查找联系人列表
     * @param {number} elderlyUserId 老人用户ID
     * @returns {Promise<Array>} 联系人列表
     */
    static async findByElderlyUserId(elderlyUserId) {
        const [rows] = await db.query(
            `SELECT c.id, c.elderly_user_id, c.contact_user_id, c.contact_role_id, 
                    c.relationship, c.is_primary, c.created_at, c.updated_at, c.contact_phone,
                    IFNULL(cu.nickname, '未设置昵称') as contact_name, 
                    IFNULL(cu.phone, '未设置电话') as contact_user_phone, 
                    r.name as contact_role_name 
             FROM contacts c
             LEFT JOIN users cu ON c.contact_user_id = cu.id
             LEFT JOIN roles r ON c.contact_role_id = r.id
             WHERE c.elderly_user_id = ?
             ORDER BY c.is_primary DESC, c.created_at DESC`,
            [elderlyUserId]
        );
        return rows;
    }
    
    /**
     * 更新联系人信息
     * @param {number} id 联系人ID
     * @param {Object} updateData 更新数据
     * @param {Object} connection 可选的数据库连接对象
     * @returns {Promise<Object|null>} 更新后的联系人信息
     */
    static async update(id, updateData, connection = null) {
        const queryMethod = connection || db;
        const { elderly_user_id, relationship, is_primary, contact_phone } = updateData;
        
        // 如果设置为主要联系人，需要将其他联系人设为非主要
        if (is_primary !== undefined && is_primary) {
            await queryMethod.query(
                'UPDATE contacts SET is_primary = 0 WHERE elderly_user_id = ? AND id != ?',
                [elderly_user_id, id]
            );
        }
        
        const [result] = await queryMethod.query(
            'UPDATE contacts SET relationship = ?, is_primary = ?, contact_phone = ? WHERE id = ?',
            [relationship, is_primary, contact_phone || null, id]
        );
        
        if (result.affectedRows === 0) {
            return null;
        }
        
        return this.findById(id, queryMethod);
    }
    
    /**
     * 删除联系人
     * @param {number} id 联系人ID
     * @param {Object} connection 可选的数据库连接对象
     * @returns {Promise<boolean>} 是否删除成功
     */
    static async delete(id, connection = null) {
        const queryMethod = connection || db;
        const [result] = await queryMethod.query(
            'DELETE FROM contacts WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }
    
    /**
     * 检查联系人是否已存在
     * @param {number} elderlyUserId 老人用户ID
     * @param {number} contactUserId 联系人用户ID
     * @returns {Promise<boolean>} 是否已存在
     */
    static async exists(elderlyUserId, contactUserId) {
        const [rows] = await db.pool.query(
            'SELECT COUNT(*) as count FROM contacts WHERE elderly_user_id = ? AND contact_user_id = ?',
            [elderlyUserId, contactUserId]
        );
        return rows[0].count > 0;
    }
    
    /**
     * 获取用户相关的所有联系人（无论是作为老人还是联系人）
     * @param {number} userId 用户ID
     * @returns {Promise<Array>} 联系人列表
     */
    static async findByUserId(userId) {
        try {
            console.log('开始查询用户ID:', userId, '的联系人');
            // 使用更直接的SQL查询，确保返回所有匹配的联系人记录
            const [rows] = await db.pool.query(
                `SELECT c.*, 
                        IFNULL(eu.nickname, '未设置昵称') as elderly_name,
                        IFNULL(eu.phone, '未设置电话') as elderly_phone,
                        IFNULL(cu.nickname, '未设置昵称') as contact_name,
                        cu.nickname,
                        cu.id as cu_id,
                        cu.phone as cu_phone,
                        cu.avatar_url,
                        cu.role_id as cu_role_id,
                        cu.status as cu_status,
                        cu.created_at as cu_created_at,
                        cu.updated_at as cu_updated_at,
                        r.name as contact_role_name
                 FROM contacts c
                 LEFT JOIN users eu ON c.elderly_user_id = eu.id
                 LEFT JOIN users cu ON c.contact_user_id = cu.id
                 LEFT JOIN roles r ON c.contact_role_id = r.id
                 WHERE c.elderly_user_id = ? OR c.contact_user_id = ?
                 ORDER BY c.is_primary DESC, c.created_at DESC`,
                [userId, userId]
            );
            
            console.log('查询到的原始记录数:', rows.length);
            console.log('原始查询结果示例:', rows.length > 0 ? JSON.stringify(rows[0], null, 2) : '无数据');
                        console.log('原始查询结果示例:', rows.length > 0 ? JSON.stringify(rows[1], null,2) : '无数据');

            // 确保结果是数组
            const resultRows = Array.isArray(rows) ? rows : [];            
            // 处理所有联系人记录，确保每个记录都正确映射字段
            const finalResults = resultRows.map(row => ({
                ...row,
                // 确保nickname字段存在
                nickname: row.nickname || row.contact_name || '未设置昵称',
                // 确保contact_user_nickname字段存在
                contact_user_nickname: row.nickname || row.contact_name || '未设置昵称',
                // 重构contact_user_details字段，使用正确的别名
                contact_user_details: {
                    id: row.cu_id,
                    nickname: row.nickname,
                    phone: row.cu_phone,
                    avatar_url: row.avatar_url,
                    role_id: row.cu_role_id,
                    status: row.cu_status,
                    created_at: row.cu_created_at,
                    updated_at: row.cu_updated_at
                }
            }));
            
            console.log('最终返回结果数量:', finalResults.length);
            return finalResults;
        } catch (error) {
            console.error('查询联系人列表失败:', error);
            throw error;
        }
    }
    
    /**
     * 根据联系人用户ID查找联系人列表并获取用户信息
     * @param {number} contactUserId 联系人用户ID
     * @returns {Promise<Array>} 联系人列表，包含用户详细信息
     */
    static async findByContactUserId(contactUserId) {
        const [rows] = await db.query(
            `SELECT c.id, c.elderly_user_id, c.contact_user_id, c.contact_role_id, 
                    c.relationship, c.is_primary, c.created_at, c.updated_at, c.contact_phone,
                   IFNULL(eu.nickname, '未设置昵称') as elderly_name, 
                   IFNULL(eu.phone, '未设置电话') as elderly_phone,
                   IFNULL(cu.nickname, '未设置昵称') as contact_name, 
                   IFNULL(cu.phone, '未设置电话') as contact_user_phone,
                   r.name as contact_role_name,
                   cu.nickname as contact_user_nickname, -- 直接获取用户昵称，便于操作
                   cu.* as contact_user_details -- 获取用户完整信息，便于更多操作
             FROM contacts c
             LEFT JOIN users eu ON c.elderly_user_id = eu.id
             LEFT JOIN users cu ON c.contact_user_id = cu.id
             LEFT JOIN roles r ON c.contact_role_id = r.id
             WHERE c.contact_user_id = ?
             ORDER BY c.is_primary DESC, c.created_at DESC`,
            [contactUserId]
        );
        return rows;
    }
    
    /**
     * 更新联系人用户的昵称
     * @param {number} contactUserId 联系人用户ID
     * @param {string} nickname 新昵称
     * @returns {Promise<Object>} 更新结果
     */
    static async updateContactUserNickname(contactUserId, nickname) {
        try {
            // 先检查用户是否存在
            const [userRows] = await db.query(
                'SELECT id FROM users WHERE id = ?',
                [contactUserId]
            );
            
            if (userRows.length === 0) {
                throw new Error('用户不存在');
            }
            
            // 更新用户昵称
            const [result] = await db.query(
                'UPDATE users SET nickname = ? WHERE id = ?',
                [nickname, contactUserId]
            );
            
            return {
                success: true,
                affectedRows: result.affectedRows,
                message: '昵称更新成功'
            };
        } catch (error) {
            console.error('更新用户昵称失败:', error);
            throw error;
        }
    }
}

module.exports = Contact;