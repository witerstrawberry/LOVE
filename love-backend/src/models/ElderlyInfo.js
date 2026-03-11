const db = require('../config/database');

const LIST_SPLIT_REGEXP = /[，,、;；\s]+/;

function normalizeList(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value
            .map(item => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
            .filter(Boolean);
    }

    return String(value)
        .split(LIST_SPLIT_REGEXP)
        .map(item => item.trim())
        .filter(Boolean);
}

function formatListValue(value) {
    if (value === undefined) {
        return undefined;
    }

    const normalized = normalizeList(value);
    return normalized.length ? normalized.join(',') : '';
}

function mapRow(row = {}) {
    if (!row) {
        return null;
    }

    return {
        ...row,
        allergen: normalizeList(row.allergen),
        diet_forbidden: normalizeList(row.diet_forbidden),
        is_common_order: Number(row.is_common_order) || 0
    };
}

class ElderlyInfo {
    /**
     * 新增老人健康信息
     */
    static async create(data = {}) {
        const payload = {
            user_id: data.user_id || null,
            user_name: data.user_name || null,
            user_old_phone: data.user_old_phone || null,
            child_id: data.child_id,
            relative_relation: data.relative_relation || null,
            is_common_order: data.is_common_order ? 1 : 0,
            blood_sugar: data.blood_sugar || null,
            blood_pressure: data.blood_pressure || null,
            allergen: formatListValue(data.allergen),
            diet_forbidden: formatListValue(data.diet_forbidden)
        };

        const result = await db.query(
            `INSERT INTO elderly_info 
             (user_id, user_name, user_old_phone, child_id, relative_relation, is_common_order, blood_sugar, blood_pressure, allergen, diet_forbidden)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.user_id,
                payload.user_name,
                payload.user_old_phone,
                payload.child_id,
                payload.relative_relation,
                payload.is_common_order,
                payload.blood_sugar,
                payload.blood_pressure,
                payload.allergen,
                payload.diet_forbidden
            ]
        );

        return this.findById(result.insertId);
    }

    /**
     * 根据记录ID获取信息
     */
    static async findById(id) {
        if (!id) {
            return null;
        }

        const rows = await db.query('SELECT * FROM elderly_info WHERE id = ?', [id]);
        return rows.length ? mapRow(rows[0]) : null;
    }

    /**
     * 根据单个用户ID获取最新的老人健康信息
     */
    static async findByUserId(userId) {
        if (!userId) {
            return null;
        }

        try {
            const rows = await db.query(
                `SELECT *
                 FROM elderly_info
                 WHERE user_id = ?
                 ORDER BY updated_at DESC, id DESC
                 LIMIT 1`,
                [userId]
            );

            return rows[0] ? mapRow(rows[0]) : null;
        } catch (error) {
            console.error('查询老人健康信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取老人信息列表（可按child_id或user_id过滤）
     */
    static async list(options = {}) {
        const { childId, userId, page = 1, pageSize = 10 } = options;
        const filters = [];
        const params = [];

        const normalizedChildId = Number.parseInt(childId, 10);
        if (!Number.isNaN(normalizedChildId)) {
            filters.push('ei.child_id = ?');
            params.push(normalizedChildId);
        }

        const normalizedUserId = Number.parseInt(userId, 10);
        if (!Number.isNaN(normalizedUserId)) {
            filters.push('ei.user_id = ?');
            params.push(normalizedUserId);
        }

        const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
        const safePageSize = Math.max(1, Number.parseInt(pageSize, 10) || 10);
        const offset = (safePage - 1) * safePageSize;

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const listSql = `
            SELECT 
                ei.*,
                u.nickname AS user_nickname,
                u.phone AS user_phone,
                u.avatar_url AS user_avatar
            FROM elderly_info ei
            LEFT JOIN users u ON u.id = ei.user_id
            ${whereClause}
            ORDER BY ei.updated_at DESC, ei.id DESC
            LIMIT ${safePageSize} OFFSET ${offset}
        `;

        const countSql = `
            SELECT COUNT(*) as total
            FROM elderly_info ei
            ${whereClause}
        `;

        const [rows, countRows] = await Promise.all([
            db.query(listSql, params),
            db.query(countSql, params)
        ]);

        return {
            items: rows.map(mapRow),
            pagination: {
                page: safePage,
                pageSize: safePageSize,
                total: countRows[0]?.total || 0
            }
        };
    }

    /**
     * 更新老人信息
     */
    static async update(id, data = {}) {
        if (!id) {
            return null;
        }

        const fields = [];
        const values = [];

        const updateMap = {
            user_id: data.user_id,
            user_name: data.user_name,
            user_old_phone: data.user_old_phone,
            child_id: data.child_id,
            relative_relation: data.relative_relation,
            is_common_order: data.is_common_order === undefined ? undefined : (data.is_common_order ? 1 : 0),
            blood_sugar: data.blood_sugar,
            blood_pressure: data.blood_pressure,
            allergen: formatListValue(data.allergen),
            diet_forbidden: formatListValue(data.diet_forbidden)
        };

        Object.entries(updateMap).forEach(([key, value]) => {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (!fields.length) {
            return this.findById(id);
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');

        await db.query(
            `UPDATE elderly_info SET ${fields.join(', ')} WHERE id = ?`,
            [...values, id]
        );

        return this.findById(id);
    }

    /**
     * 删除老人健康信息
     */
    static async delete(id) {
        if (!id) {
            return 0;
        }

        const result = await db.query('DELETE FROM elderly_info WHERE id = ?', [id]);
        return result.affectedRows || 0;
    }

    /**
     * 根据子女账号统计关联老人数量
     */
    static async countByChildId(childId) {
        if (!childId) {
            return 0;
        }

        const rows = await db.query(
            'SELECT COUNT(*) AS total FROM elderly_info WHERE child_id = ?',
            [childId]
        );
        return rows[0]?.total || 0;
    }

    /**
     * 根据老人用户ID统计记录数量
     */
    static async countByUserId(userId) {
        if (!userId) {
            return 0;
        }

        const rows = await db.query(
            'SELECT COUNT(*) AS total FROM elderly_info WHERE user_id = ?',
            [userId]
        );
        return rows[0]?.total || 0;
    }

    /**
     * 批量获取多个用户的最新老人健康信息
     */
    static async getLatestByUserIds(userIds = []) {
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return new Map();
        }

        const uniqueIds = Array.from(new Set(userIds.filter(id => !!id)));
        if (uniqueIds.length === 0) {
            return new Map();
        }

        const placeholders = uniqueIds.map(() => '?').join(', ');

        try {
            const rows = await db.query(
                `SELECT *
                 FROM elderly_info
                 WHERE user_id IN (${placeholders})
                 ORDER BY user_id ASC, updated_at DESC, id DESC`,
                uniqueIds
            );

            const infoMap = new Map();
            rows.forEach(row => {
                if (row.user_id && !infoMap.has(row.user_id)) {
                    infoMap.set(row.user_id, mapRow(row));
                }
            });

            return infoMap;
        } catch (error) {
            console.error('批量查询老人健康信息失败:', error);
            throw error;
        }
    }
}

module.exports = ElderlyInfo;

