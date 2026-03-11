const db = require('../config/database');

class Notification {
  static normalizeMerchantId(merchantId) {
    if (!merchantId) return null;
    const id = merchantId.toString().trim();
    return id.startsWith('MER') ? id : `MER${id}`;
  }

  /**
   * 获取商家通知列表
   */
  static async getMerchantNotifications(merchantId, includeSystem = true) {
    try {
      const params = [];
      let whereClause = 'mn.is_deleted = 0';

      if (merchantId) {
        whereClause += ' AND (mn.merchant_id = ?';
        params.push(merchantId);
        if (includeSystem) {
          whereClause += " OR mn.type = 'system'";
        }
        whereClause += ')';
      } else if (includeSystem) {
        whereClause += " AND mn.type = 'system'";
      } else {
        whereClause += ' AND 1 = 0';
      }

      const query = `
        SELECT 
          mn.id,
          mn.merchant_id,
          mn.title,
          mn.content,
          mn.type,
          mn.created_at,
          mn.updated_at,
          m.name AS merchant_name,
          m.address AS merchant_address,
          m.phone AS merchant_phone
        FROM merchant_notifications mn
        LEFT JOIN merchants m ON mn.merchant_id = m.id
        WHERE ${whereClause}
        ORDER BY mn.created_at DESC
      `;

      const [rows] = await db.execute(query, params);
      return rows;
    } catch (error) {
      console.error('获取商家通知失败:', error);
      throw error;
    }
  }

  /**
   * 获取志愿者通知（系统或公共公告）
   */
  static async getVolunteerNotifications(limit = 50) {
    try {
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const query = `
        SELECT 
          mn.id,
          mn.merchant_id,
          mn.title,
          mn.content,
          mn.type,
          mn.created_at,
          mn.updated_at,
          COALESCE(m.name, '系统消息') AS merchant_name
        FROM merchant_notifications mn
        LEFT JOIN merchants m ON (
          CASE 
            WHEN mn.merchant_id IS NULL OR mn.merchant_id = '' THEN NULL
            WHEN mn.merchant_id LIKE 'MER%' THEN mn.merchant_id
            ELSE CONCAT('MER', mn.merchant_id)
          END
        ) = m.id
        WHERE mn.is_deleted = 0
        ORDER BY mn.created_at DESC
        LIMIT ${safeLimit}
      `;
      const rows = await db.rawQuery(query);
      return rows;
    } catch (error) {
      console.error('获取志愿者通知失败:', error);
      throw error;
    }
  }

  /**
   * 创建通知
   */
  static async createNotification({ merchantId, title, content, type = 'merchant' }) {
    try {
      const normalizedId = type === 'system' ? null : this.normalizeMerchantId(merchantId);
      const query = `
        INSERT INTO merchant_notifications (merchant_id, title, content, type)
        VALUES (?, ?, ?, ?)
      `;
      const params = [normalizedId, title, content, type];
      const [result] = await db.execute(query, params);
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('创建通知失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找通知
   */
  static async findById(id) {
    try {
      const query = `
        SELECT 
          mn.*,
          m.name AS merchant_name,
          m.address AS merchant_address
        FROM merchant_notifications mn
        LEFT JOIN merchants m ON mn.merchant_id = m.id
        WHERE mn.id = ? AND mn.is_deleted = 0
      `;
      const [rows] = await db.execute(query, [id]);
      return rows && rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('查找通知失败:', error);
      throw error;
    }
  }

  /**
   * 更新通知
   */
  static async updateNotification(id, merchantId, data) {
    try {
      const normalizedId = this.normalizeMerchantId(merchantId);
      const allowedFields = ['title', 'content', 'type'];
      const fields = [];
      const params = [];

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`);
          params.push(data[field]);
        }
      });

      if (fields.length === 0) {
        return await this.findById(id);
      }

      params.push(id, normalizedId);

      const query = `
        UPDATE merchant_notifications
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND merchant_id = ? AND type = 'merchant' AND is_deleted = 0
      `;

      const [result] = await db.execute(query, params);
      if (result.affectedRows === 0) {
        throw new Error('通知不存在或无权限更新');
      }

      return await this.findById(id);
    } catch (error) {
      console.error('更新通知失败:', error);
      throw error;
    }
  }

  /**
   * 删除通知
   */
  static async deleteNotification(id, merchantId) {
    try {
      const normalizedId = this.normalizeMerchantId(merchantId);
      const query = `
        DELETE FROM merchant_notifications
        WHERE id = ? AND merchant_id = ? AND type = 'merchant'
      `;
      const params = [id, normalizedId];
      const [result] = await db.execute(query, params);
      if (result.affectedRows === 0) {
        throw new Error('通知不存在或无权限删除');
      }
      return true;
    } catch (error) {
      console.error('删除通知失败:', error);
      throw error;
    }
  }

  /**
   * 删除系统通知（管理员使用）
   * 这里采用软删除，将 is_deleted 置为 1，避免误删数据无法恢复
   */
  static async deleteSystemNotification(id) {
    try {
      const query = `
        UPDATE merchant_notifications
        SET is_deleted = 1
        WHERE id = ? AND type = 'system' AND is_deleted = 0
      `;
      const [result] = await db.execute(query, [id]);
      if (result.affectedRows === 0) {
        throw new Error('系统通知不存在或已被删除');
      }
      return true;
    } catch (error) {
      console.error('删除系统通知失败:', error);
      throw error;
    }
  }
}

module.exports = Notification;

