// 志愿者数据模型 - 使用mysql2/promise
const db = require('../config/database');

class Volunteer {
    constructor() {
        this.tableName = 'volunteer';
    }

    // 查找单条记录
    async findOne(where) {
        try {
            let sql = `SELECT * FROM ${this.tableName} WHERE `;
            const params = [];
            
            Object.keys(where).forEach((key, index) => {
                if (index > 0) sql += ' AND ';
                sql += `${key} = ?`;
                params.push(where[key]);
            });
            
            const rows = await db.query(sql, params);
            return rows[0] || null;
        } catch (error) {
            console.error('Volunteer findOne error:', error);
            throw error;
        }
    }

    // 创建记录
    async create(data) {
        try {
            const keys = Object.keys(data);
            const values = Object.values(data);
            const placeholders = keys.map(() => '?').join(', ');
            
            const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
            const [result] = await db.execute(sql, values);
            
            return { insertId: result.insertId, ...data };
        } catch (error) {
            console.error('Volunteer create error:', error);
            throw error;
        }
    }

    // 更新记录
    async update(data, where) {
        try {
            let sql = `UPDATE ${this.tableName} SET `;
            const params = [];
            
            // 构建更新字段
            Object.keys(data).forEach((key, index) => {
                if (index > 0) sql += ', ';
                sql += `${key} = ?`;
                params.push(data[key]);
            });
            
            // 构建WHERE条件
            sql += ' WHERE ';
            Object.keys(where).forEach((key, index) => {
                if (index > 0) sql += ' AND ';
                sql += `${key} = ?`;
                params.push(where[key]);
            });
            
            const [result] = await db.execute(sql, params);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Volunteer update error:', error);
            throw error;
        }
    }

    // 根据条件查询，带字段过滤
    async findOneWithAttributes(where, attributes) {
        try {
            let sql = `SELECT ${attributes.join(', ')} FROM ${this.tableName} WHERE `;
            const params = [];
            
            Object.keys(where).forEach((key, index) => {
                if (index > 0) sql += ' AND ';
                sql += `${key} = ?`;
                params.push(where[key]);
            });
            
            const rows = await db.query(sql, params);
            return rows[0] || null;
        } catch (error) {
            console.error('Volunteer findOneWithAttributes error:', error);
            throw error;
        }
    }

    async getFullProfileByUserId(userId) {
        try {
            const sql = `
                SELECT 
                    v.volunteer_id,
                    v.real_name,
                    v.id_card,
                    v.gender,
                    v.age,
                    v.address,
                    v.emergency_contact,
                    v.service_hours,
                    v.status,
                    v.created_at,
                    v.updated_at,
                    u.phone,
                    u.nickname,
                    u.avatar_url,
                    u.status AS user_status,
                    u.created_at AS user_created_at
                FROM ${this.tableName} v
                JOIN users u ON v.user_id = u.id
                WHERE v.user_id = ?
                LIMIT 1
            `;
            const rows = await db.query(sql, [userId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Volunteer getFullProfileByUserId error:', error);
            throw error;
        }
    }
}

module.exports = new Volunteer();