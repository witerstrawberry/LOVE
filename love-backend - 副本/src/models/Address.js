// 导入数据库连接配置
const db = require('../config/database');

class Address {
    /**
     * 获取用户的所有地址
     * @param {number} userId 用户ID
     * @returns {Array} 地址列表
     */
    static async getAddressesByUserId(userId) {
        try {
            const sql = 'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC';
            const rows = await db.query(sql, [userId]);
            return rows;
        } catch (error) {
            console.error('获取用户地址列表失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取地址
     * @param {number} id 地址ID
     * @returns {Object|null} 地址信息
     */
    static async getAddressById(id) {
        try {
            const sql = 'SELECT * FROM user_addresses WHERE id = ?';
            const rows = await db.query(sql, [id]);
            return rows[0] || null;
        } catch (error) {
            console.error('根据ID获取地址失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户的默认地址
     * @param {number} userId 用户ID
     * @returns {Object|null} 默认地址信息
     */
    static async getDefaultAddressByUserId(userId) {
        try {
            const sql = 'SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1';
            const rows = await db.query(sql, [userId]);
            return rows[0] || null;
        } catch (error) {
            console.error('获取用户默认地址失败:', error);
            throw error;
        }
    }

    /**
     * 添加新地址
     * @param {Object} addressData 地址数据
     * @returns {number} 新地址ID
     */
    static async create(addressData) {
        try {
            const { user_id, recipient_name, phone, province, city, district, detail_address, is_default = 0 } = addressData;
            
            // 如果设置为默认地址，先取消该用户其他地址的默认状态
            if (is_default) {
                await db.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [user_id]);
            }
            
            const sql = 'INSERT INTO user_addresses (user_id, recipient_name, phone, province, city, district, detail_address, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            const result = await db.execute(sql, [user_id, recipient_name, phone, province, city, district, detail_address, is_default]);
            
            return result[0].insertId;
        } catch (error) {
            console.error('添加新地址失败:', error);
            throw error;
        }
    }

    /**
     * 更新地址信息
     * @param {number} id 地址ID
     * @param {number} userId 用户ID
     * @param {Object} addressData 要更新的地址数据
     * @param {boolean} isDefault 是否设为默认地址
     * @returns {boolean} 更新结果
     */
    static async update(id, userId, addressData, isDefault) {
        try {
            const { recipient_name, phone, province, city, district, detail_address } = addressData;
            
            // 检查地址是否存在且属于该用户
            const address = await this.getAddressById(id);
            if (!address || address.user_id !== userId) {
                return false;
            }
            
            // 如果设置为默认地址，先取消该用户其他地址的默认状态
            if (isDefault) {
                await db.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
            }
            
            const sql = 'UPDATE user_addresses SET recipient_name = ?, phone = ?, province = ?, city = ?, district = ?, detail_address = ?, is_default = ? WHERE id = ?';
            const result = await db.execute(sql, [recipient_name, phone, province, city, district, detail_address, isDefault ? 1 : 0, id]);
            
            return result[0].affectedRows > 0;
        } catch (error) {
            console.error('更新地址失败:', error);
            throw error;
        }
    }

    /**
     * 设置默认地址
     * @param {number} id 地址ID
     * @param {number} userId 用户ID
     * @returns {boolean} 设置结果
     */
    static async setDefault(id, userId) {
        try {
            // 开始事务
            await db.transaction(async (connection) => {
                // 取消该用户其他地址的默认状态
                await connection.execute('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
                // 设置当前地址为默认
                await connection.execute('UPDATE user_addresses SET is_default = 1 WHERE id = ?', [id]);
            });
            
            return true;
        } catch (error) {
            console.error('设置默认地址失败:', error);
            throw error;
        }
    }

    /**
     * 删除地址
     * @param {number} id 地址ID
     * @param {number} userId 用户ID
     * @returns {boolean} 删除结果
     */
    static async delete(id, userId) {
        try {
            // 检查地址是否存在且属于该用户
            const address = await this.getAddressById(id);
            if (!address || address.user_id !== userId) {
                return false;
            }
            
            const sql = 'DELETE FROM user_addresses WHERE id = ?';
            const result = await db.execute(sql, [id]);
            
            return result[0].affectedRows > 0;
        } catch (error) {
            console.error('删除地址失败:', error);
            throw error;
        }
    }
}

module.exports = Address;