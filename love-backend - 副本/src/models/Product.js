const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// 日志写入函数，确保我们能捕获所有调试信息
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // 输出到控制台
  console.log(logMessage);
  
  // 同时写入日志文件
  const logFilePath = path.join(__dirname, '..', '..', 'debug.log');
  // 使用utf8编码确保中文显示正常
  fs.appendFile(logFilePath, logMessage, 'utf8', (err) => {
    if (err) {
      console.error('写入日志文件失败:', err);
    }
  });
}

class Product {
    /**
     * 获取所有商品列表（支持分页）
     * @param {number} page 页码，默认为1
     * @param {number} limit 每页数量，默认为10
     * @param {Object} filters 过滤条件
     * @returns {Object} 商品列表和总数
     */
    static async getList(page = 1, limit = 10, filters = {}) {
        try {
            // 确保参数类型正确
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const offset = (pageNum - 1) * limitNum;
            
            // 初始化WHERE子句，支持单一状态或状态数组
            let whereClause = '';
            let params = [];
            
            // 处理status过滤条件
            if (filters.status) {
                if (Array.isArray(filters.status) && filters.status.length > 0) {
                    // 处理数组形式的status参数
                    const placeholders = filters.status.map(() => '?').join(', ');
                    whereClause = `WHERE p.status IN (${placeholders})`;
                    params.push(...filters.status);
                } else if (typeof filters.status === 'string') {
                    // 处理单一字符串形式的status参数
                    whereClause = 'WHERE p.status = ?';
                    params.push(filters.status);
                }
            } else {
                // 默认只查询active状态
                whereClause = 'WHERE p.status = ?';
                params.push('active');
            };

            // 按商家ID筛选
            if (filters.merchant_id && typeof filters.merchant_id === 'string' && filters.merchant_id.trim()) {
                whereClause += ' AND p.merchant_id = ?';
                params.push(filters.merchant_id.trim());
            }

            // 按分类筛选
            if (filters.category_id) {
                const categoryId = parseInt(filters.category_id);
                if (!isNaN(categoryId)) {
                    whereClause += ' AND p.category_id = ?';
                    params.push(categoryId);
                }
            }

            // 按名称搜索
            if (filters.name && typeof filters.name === 'string' && filters.name.trim()) {
                whereClause += ' AND p.name LIKE ?';
                params.push(`%${filters.name.trim()}%`);
            }

            // 价格范围筛选
            if (filters.min_price !== undefined && filters.min_price !== null) {
                const minPrice = parseFloat(filters.min_price);
                if (!isNaN(minPrice) && minPrice >= 0) {
                    whereClause += ' AND p.price >= ?';
                    params.push(minPrice);
                }
            }
            
            if (filters.max_price !== undefined && filters.max_price !== null) {
                const maxPrice = parseFloat(filters.max_price);
                if (!isNaN(maxPrice) && maxPrice >= 0) {
                    whereClause += ' AND p.price <= ?';
                    params.push(maxPrice);
                }
            }

            // 排序条件
            let orderBy = 'ORDER BY p.sort_order ASC, p.created_at DESC';
            if (filters.sort_by === 'price_asc') {
                orderBy = 'ORDER BY p.price ASC';
            } else if (filters.sort_by === 'price_desc') {
                orderBy = 'ORDER BY p.price DESC';
            } else if (filters.sort_by === 'view_count') {
                orderBy = 'ORDER BY p.view_count DESC';
            } else if (filters.sort_by === 'created_desc') {
                orderBy = 'ORDER BY p.created_at DESC';
            }

            // 查询商品列表 - 使用更简洁的SQL语法
            const query = `
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.price,
                    p.image_url,
                    p.status,
                    p.view_count,
                    p.sort_order,
                    p.created_at,
                    p.merchant_id,
                    c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                ${whereClause}
                ${orderBy}
                LIMIT ${limitNum} OFFSET ${offset}
            `;

            // 不使用占位符的LIMIT和OFFSET，直接拼接数值
            console.log('=== SQL调试信息 ===');
            console.log('WHERE Clause:', whereClause);
            console.log('Params (不包含LIMIT/OFFSET):', params);
            console.log('Page:', pageNum, 'Limit:', limitNum, 'Offset:', offset);
            console.log('SQL Query:', query.replace(/\s+/g, ' ').trim());
            
            // 验证参数数量 - 现在只需要验证WHERE条件的参数
            const placeholderCount = (whereClause.match(/\?/g) || []).length;
            console.log('WHERE占位符数量:', placeholderCount, '参数数量:', params.length);
            
            if (placeholderCount !== params.length) {
                console.error('参数数量不匹配!');
                throw new Error(`WHERE占位符数量(${placeholderCount})与参数数量(${params.length})不匹配`);
            }

            // 确保所有参数都不是undefined或null
            const validParams = params.map((param, index) => {
                if (param === undefined || param === null) {
                    console.error(`参数${index}为${param}, 类型: ${typeof param}`);
                    throw new Error(`参数${index}不能为${param}`);
                }
                return param;
            });

            console.log('验证后的参数:', validParams);
            const [products] = await db.execute(query, validParams);

            // 查询总数 - 使用相同的WHERE条件但不包含LIMIT和OFFSET参数
            const countQuery = `
                SELECT COUNT(*) as total
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                ${whereClause}
            `;
            
            const [countResult] = await db.execute(countQuery, params);
            const total = countResult[0].total;

            return {
                products,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            };
        } catch (error) {
            console.error('获取商品列表失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取商品详情
     * @param {number} id 商品ID
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {Object|null} 商品详情
     */
    static async findById(id, connection = null, options = {}) {
        try {
            const { includeInactive = false } = options;
            writeLog(`Product模型: 尝试查询商品ID: ${id}，类型: ${typeof id}`);
            
            // 验证ID类型
            const productId = parseInt(id);
            writeLog(`Product模型: 转换后的商品ID: ${productId}，类型: ${typeof productId}`);
            
            const query = `
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.price,
                    p.image_url,
                    p.status,
                    p.view_count,
                    p.sort_order,
                    p.created_at,
                    p.updated_at,
                    p.stock as stock, -- 修正字段名为stock，保持与数据库一致
                    p.merchant_id,
                    c.id as category_id,
                    c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.id = ?
                ${includeInactive ? '' : 'AND p.status = "active"'}
            `;

            const queryMethod = connection ? connection.execute : db.execute;
            const queryParams = [productId];
            const [rows] = await queryMethod(query, queryParams);
            writeLog(`Product模型: 查询结果行数: ${rows ? rows.length : 0}`);
            
            if (rows && rows.length > 0) {
                writeLog(`Product模型: 找到商品，ID: ${rows[0].id}，名称: ${rows[0].name}，状态: ${rows[0].status}，库存: ${rows[0].stock || '未设置'}`);
                writeLog(`Product模型: 商品图片URL: ${rows[0].image_url}`);
            } else {
                writeLog(`Product模型: 未找到商品，ID: ${productId}`);
                // 检查是否有该ID但状态不是active的商品
                const allStatusQuery = `
                    SELECT 
                        p.id,
                        p.name,
                        p.status
                    FROM products p
                    WHERE p.id = ?
                `;
                const allStatusResult = await queryMethod(allStatusQuery, [productId]);
                const allStatusRows = Array.isArray(allStatusResult) ? allStatusResult[0] : allStatusResult;
                if (allStatusRows && allStatusRows.length > 0) {
                    writeLog(`Product模型: 找到商品但状态不是active，ID: ${allStatusRows[0].id}，名称: ${allStatusRows[0].name}，状态: ${allStatusRows[0].status}`);
                }
            }
            
            // 安全地返回结果，确保在访问rows[0]之前先验证rows是否存在
            return (rows && rows[0]) || null;
        } catch (error) {
            console.error('获取商品详情失败:', error);
            throw error;
        }
    }

    /**
     * 根据分类ID获取商品列表
     * @param {number} categoryId 分类ID
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @param {Object} filters 额外过滤条件
     * @returns {Object} 商品列表和总数
     */
    static async getByCategory(categoryId, page = 1, limit = 10, filters = {}) {
        try {
            const mergedFilters = { ...filters, category_id: categoryId };
            return await this.getList(page, limit, mergedFilters);
        } catch (error) {
            console.error('根据分类获取商品失败:', error);
            throw error;
        }
    }

    /**
     * 增加商品浏览次数
     * @param {number} id 商品ID
     * @returns {boolean} 是否成功
     */
    static async incrementViewCount(id) {
        try {
            await db.query(
                'UPDATE products SET view_count = view_count + 1 WHERE id = ?',
                [id]
            );
            return true;
        } catch (error) {
            console.error('增加浏览次数失败:', error);
            throw error;
        }
    }

    /**
     * 获取热门商品（按浏览量排序）
     * @param {number} limit 数量限制，默认为10
     * @returns {Array} 热门商品列表
     */
    static async getPopular(limit = 10) {
        try {
            const query = `
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.price,
                    p.image_url,
                    p.view_count,
                    p.merchant_id,
                    c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.status = "active"
                ORDER BY p.view_count DESC, p.created_at DESC
                LIMIT ?
            `;

            const [products] = await db.execute(query, [limit]);
            return products;
        } catch (error) {
            console.error('获取热门商品失败:', error);
            throw error;
        }
    }

    /**
     * 搜索商品
     * @param {string} keyword 搜索关键词
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @returns {Object} 搜索结果
     */
    static async search(keyword, page = 1, limit = 10) {
        try {
            const filters = {
                name: keyword
            };
            return await this.getList(page, limit, filters);
        } catch (error) {
            console.error('搜索商品失败:', error);
            throw error;
        }
    }

    /**
     * 根据商家ID获取商品列表
     * @param {string} merchantId 商家ID
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @param {Object} filters 额外过滤条件
     * @returns {Object} 商品列表和总数
     */
    static async getByMerchant(merchantId, page = 1, limit = 10, filters = {}) {
        try {
            const mergedFilters = { ...filters, merchant_id: merchantId };
            return await this.getList(page, limit, mergedFilters);
        } catch (error) {
            console.error('根据商家获取商品失败:', error);
            throw error;
        }
    }

    /**
     * 检查商品是否属于指定商家
     * @param {number} productId 商品ID
     * @param {string} merchantId 商家ID
     * @returns {boolean} 是否属于该商家
     */
    static async belongsToMerchant(productId, merchantId) {
        try {
            const query = `
                SELECT id FROM products 
                WHERE id = ? AND merchant_id = ?
            `;
            const [rows] = await db.execute(query, [productId, merchantId]);
            return rows && rows.length > 0;
        } catch (error) {
            console.error('检查商品归属失败:', error);
            throw error;
        }
    }

    /**
     * 创建商品
     * @param {Object} productData 商品数据
     * @returns {Object} 创建的商品信息
     */
    static async create(productData) {
        try {
            // 验证必要字段
            const { merchant_id, category_id, name, price } = productData;
            if (!merchant_id || !category_id || !name || price === undefined) {
                throw new Error('缺少必要的商品信息');
            }

            const query = `
                INSERT INTO products 
                (merchant_id, category_id, name, description, price, image_url, status, sort_order, stock) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                merchant_id,
                category_id,
                name,
                productData.description || '',
                parseFloat(price) || 0,
                productData.image_url || null,
                productData.status || 'active',
                productData.sort_order || 0,
                productData.stock || 0
            ];

            const [result] = await db.execute(query, params);
            return await this.findById(result.insertId);
        } catch (error) {
            console.error('创建商品失败:', error);
            throw error;
        }
    }

    /**
     * 更新商品
     * @param {number} id 商品ID
     * @param {Object} productData 商品数据
     * @param {string} merchantId 商家ID（用于权限验证）
     * @returns {Object|null} 更新后的商品信息
     */
    static async update(id, productData, merchantId) {
        try {
            // 验证权限
            const belongs = await this.belongsToMerchant(id, merchantId);
            if (!belongs) {
                throw new Error('无权更新此商品');
            }

            // 构建更新字段和参数
            let updateFields = [];
            let params = [];

            if (productData.category_id !== undefined) {
                updateFields.push('category_id = ?');
                params.push(productData.category_id);
            }

            if (productData.name !== undefined) {
                updateFields.push('name = ?');
                params.push(productData.name);
            }

            if (productData.description !== undefined) {
                updateFields.push('description = ?');
                params.push(productData.description);
            }

            if (productData.price !== undefined) {
                updateFields.push('price = ?');
                params.push(parseFloat(productData.price) || 0);
            }

            if (productData.image_url !== undefined) {
                updateFields.push('image_url = ?');
                params.push(productData.image_url);
            }

            if (productData.status !== undefined) {
                updateFields.push('status = ?');
                params.push(productData.status);
            }

            if (productData.sort_order !== undefined) {
                updateFields.push('sort_order = ?');
                params.push(productData.sort_order);
            }

            if (productData.stock !== undefined) {
                updateFields.push('stock = ?');
                params.push(productData.stock);
            }

            if (updateFields.length === 0) {
                return await this.findById(id);
            }

            params.push(id);
            const query = `
                UPDATE products 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `;

            await db.execute(query, params);
            return await this.findById(id, null, { includeInactive: true });
        } catch (error) {
            console.error('更新商品失败:', error);
            throw error;
        }
    }

    /**
     * 删除商品（软删除，设置状态为inactive）
     * @param {number} id 商品ID
     * @param {string} merchantId 商家ID（用于权限验证）
     * @returns {boolean} 是否成功
     */
    static async delete(id, merchantId) {
        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            const [checkResult] = await connection.execute(
                'SELECT 1 FROM products WHERE id = ? AND merchant_id = ?',
                [id, merchantId]
            );

            if (checkResult.length === 0) {
                throw new Error('商品不存在或无权限操作');
            }

            await connection.execute('DELETE FROM order_items WHERE product_id = ?', [id]);
            const [result] = await connection.execute(
                'DELETE FROM products WHERE id = ? AND merchant_id = ?',
                [id, merchantId]
            );

            if (result.affectedRows === 0) {
                throw new Error('商品删除失败');
            }

            await connection.commit();
            return {
                success: true,
                message: '商品删除成功'
            };
        } catch (error) {
            await connection.rollback();
            console.error('删除商品失败:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 更新商品库存
     * @param {number} id 商品ID
     * @param {number} quantity 变更数量（正数增加，负数减少）
     * @param {Object} connection 可选的数据库连接对象（用于事务）
     * @returns {boolean} 是否成功
     */
    static async updateStock(id, quantity, connection = null) {
        try {
            const query = `
                UPDATE products 
                SET stock = stock + ? 
                WHERE id = ? AND stock + ? >= 0
            `;

            const queryMethod = connection ? connection.execute : db.execute;
            const [result] = await queryMethod(query, [quantity, id, quantity]);
            
            if (result.affectedRows === 0) {
                throw new Error('库存不足或商品不存在');
            }
            
            return true;
        } catch (error) {
            console.error('更新库存失败:', error);
            throw error;
        }
    }
}

module.exports = Product;