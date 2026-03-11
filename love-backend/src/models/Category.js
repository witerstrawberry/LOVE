const db = require('../config/database');
class Category {
    /**
     * 获取所有分类列表
     * @param {boolean} includeInactive 是否包含未启用的分类，默认为false
     * @returns {Array} 分类列表
     */
    static async getAll(includeInactive = false) {
        try {
            let query = `
                SELECT 
                    id,
                    name,
                    sort_order,
                    status,
                    created_at,
                    updated_at
                FROM categories
            `;

            if (!includeInactive) {
                query += ' WHERE status = "active"';
            }

            query += ' ORDER BY sort_order ASC, created_at ASC';

            const [categories] = await db.execute(query);
            return categories;
        } catch (error) {
            console.error('获取分类列表失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取分类详情
     * @param {number} id 分类ID
     * @returns {Object|null} 分类详情
     */
    static async findById(id) {
        try {
            const query = `
                SELECT 
                    id,
                    name,
                    sort_order,
                    status,
                    created_at,
                    updated_at
                FROM categories
                WHERE id = ?
            `;

            const [rows] = await db.execute(query, [id]);
            return rows[0] || null;
        } catch (error) {
            console.error('获取分类详情失败:', error);
            throw error;
        }
    }

    /**
     * 获取分类及其商品数量
     * @param {boolean} onlyActive 是否只获取启用的分类，默认为true
     * @returns {Array} 分类列表（包含商品数量）
     */
    static async getCategoriesWithProductCount(onlyActive = true) {
        try {
            let whereClause = '';
            if (onlyActive) {
                whereClause = 'WHERE c.status = "active"';
            }

            const query = `
                SELECT 
                    c.id,
                    c.name,
                    c.sort_order,
                    c.status,
                    c.created_at,
                    COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.status = "active"
                ${whereClause}
                GROUP BY c.id, c.name, c.sort_order, c.status, c.created_at
                ORDER BY c.sort_order ASC, c.created_at ASC
            `;

            const [categories] = await db.execute(query);
            return categories;
        } catch (error) {
            console.error('获取分类及商品数量失败:', error);
            throw error;
        }
    }

    /**
     * 根据名称查找分类
     * @param {string} name 分类名称
     * @returns {Object|null} 分类信息
     */
    static async findByName(name) {
        try {
            const query = `
                SELECT 
                    id,
                    name,
                    sort_order,
                    status,
                    created_at,
                    updated_at
                FROM categories
                WHERE name = ?
            `;

            const [rows] = await db.execute(query, [name]);
            return rows[0] || null;
        } catch (error) {
            console.error('根据名称查找分类失败:', error);
            throw error;
        }
    }

    /**
     * 获取启用的分类列表（简化版，仅返回id和name）
     * @returns {Array} 简化的分类列表
     */
    static async getActiveSimple() {
        try {
            const query = `
                SELECT 
                    id,
                    name
                FROM categories
                WHERE status = "active"
                ORDER BY sort_order ASC, created_at ASC
            `;

            const [categories] = await db.execute(query);
            return categories;
        } catch (error) {
            console.error('获取简化分类列表失败:', error);
            throw error;
        }
    }

    /**
     * 检查分类是否存在且启用
     * @param {number} id 分类ID
     * @returns {boolean} 是否存在且启用
     */
    static async isActiveCategory(id) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM categories
                WHERE id = ? AND status = "active"
            `;

            const [rows] = await db.execute(query, [id]);
            return rows[0].count > 0;
        } catch (error) {
            console.error('检查分类状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取分类下的商品预览（限制数量）
     * @param {number} categoryId 分类ID
     * @param {number} limit 商品数量限制，默认为5
     * @returns {Object} 分类信息及其商品预览
     */
    static async getCategoryWithProducts(categoryId, limit = 5) {
        try {
            // 获取分类信息
            const category = await this.findById(categoryId);
            if (!category) {
                return null;
            }

            // 获取该分类下的商品预览
            const productsQuery = `
                SELECT 
                    id,
                    name,
                    price,
                    image_url,
                    view_count
                FROM products
                WHERE category_id = ? AND status = "active"
                ORDER BY sort_order ASC, created_at DESC
                LIMIT ?
            `;

            const [products] = await db.execute(productsQuery, [categoryId, limit]);

            return {
                ...category,
                products
            };
        } catch (error) {
            console.error('获取分类及商品预览失败:', error);
            throw error;
        }
    }
}

module.exports = Category;