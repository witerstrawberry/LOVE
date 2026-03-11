const Product = require('../models/Product');
const Category = require('../models/Category');
const { success, error, badRequest, notFound } = require('../utils/response');
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
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error('写入日志文件失败:', err);
    }
  });
}

class ProductController {
    /**
     * 获取商品列表
     */
    async getProducts(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                category_id,
                name,
                min_price,
                max_price,
                sort_by
            } = req.query;

            // 验证分页参数
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
                return badRequest(res, '分页参数不正确');
            }

            // 构建过滤条件
            const filters = {};
            if (category_id) {
                const categoryIdNum = parseInt(category_id);
                if (isNaN(categoryIdNum)) {
                    return badRequest(res, '分类ID格式不正确');
                }
                
                // 验证分类是否存在且启用
                const isValidCategory = await Category.isActiveCategory(categoryIdNum);
                if (!isValidCategory) {
                    return badRequest(res, '指定的分类不存在或未启用');
                }
                
                filters.category_id = categoryIdNum;
            }

            if (name && name.trim()) {
                filters.name = name.trim();
            }

            if (min_price) {
                const minPriceNum = parseFloat(min_price);
                if (!isNaN(minPriceNum) && minPriceNum >= 0) {
                    filters.min_price = minPriceNum;
                }
            }

            if (max_price) {
                const maxPriceNum = parseFloat(max_price);
                if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
                    filters.max_price = maxPriceNum;
                }
            }

            if (sort_by && ['price_asc', 'price_desc', 'view_count'].includes(sort_by)) {
                filters.sort_by = sort_by;
            }

            const merchantId = req.query.merchant_id || req.query.merchantId;
            if (merchantId && merchantId.toString().trim() !== '') {
                filters.merchant_id = merchantId.toString().trim();
            }

            // 获取商品列表
            const result = await Product.getList(pageNum, limitNum, filters);

            return success(res, result, '获取商品列表成功');
        } catch (err) {
            console.error('获取商品列表失败:', err);
            return error(res, '获取商品列表失败');
        }
    }

    /**
     * 获取商品详情
     */
    async getProductById(req, res) {
        try {
            writeLog('=== 商品详情请求开始 ===');
            writeLog('完整的请求路径: ' + req.path);
            writeLog('请求参数对象: ' + JSON.stringify(req.params));
            
            const { id } = req.params;
            writeLog('原始ID参数: ' + id + ' 类型: ' + typeof id);
            
            const productId = parseInt(id);
            writeLog('转换后的产品ID: ' + productId + ' 类型: ' + typeof productId + ' isNaN: ' + isNaN(productId));

            if (isNaN(productId) || productId < 1) {
                writeLog('❌ 商品ID格式不正确');
                return badRequest(res, '商品ID格式不正确');
            }

            writeLog(`接收到商品详情请求，ID: ${productId}`);
            // 直接在控制器中执行查询，不通过Product模型，以排除模型层的问题
            const db = require('../config/database');
            const directQuery = `
                SELECT 
                    p.id,
                    p.name,
                    p.status,
                    p.image_url
                FROM products p
                WHERE p.id = ?
            `;
            writeLog(`执行直接数据库查询: ${directQuery}，参数: [${productId}]`);
            const [directResult] = await db.execute(directQuery, [productId]);
            writeLog(`直接查询结果: ${JSON.stringify(directResult)}`);
            
            // 获取商品详情
            writeLog('通过Product模型查询商品');
            const product = await Product.findById(productId);
            writeLog('Product模型查询结果: ' + (product ? '找到商品' : '未找到商品'));
            
            if (!product) {
                writeLog(`未找到商品，ID: ${productId}`);
                return notFound(res, '商品不存在');
            }

            writeLog(`获取商品详情成功，商品ID: ${productId}，库存: ${product.stock || '未设置'}`);
            // 增加浏览次数
            await Product.incrementViewCount(productId);

            // 处理图片URL，确保返回完整的可访问路径
            if (product.image_url) {
                // 如果图片URL不是以http开头，添加服务器地址前缀
                if (!product.image_url.startsWith('http')) {
                    // 确保URL以/开头
                    const imageUrl = product.image_url.startsWith('/') ? 
                        product.image_url : `/${product.image_url}`;
                    // 添加服务器地址前缀
                    product.image_url = `http://localhost:3000${imageUrl}`;
                }
            }

            return success(res, product, '获取商品详情成功');
        } catch (err) {
            console.error('获取商品详情失败:', err);
            return error(res, '获取商品详情失败');
        }
    }

    /**
     * 根据分类获取商品列表
     */
    async getProductsByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const {
                page = 1,
                limit = 10,
                name,
                min_price,
                max_price,
                sort_by
            } = req.query;

            const categoryIdNum = parseInt(categoryId);
            if (isNaN(categoryIdNum) || categoryIdNum < 1) {
                return badRequest(res, '分类ID格式不正确');
            }

            // 验证分类是否存在且启用
            const isValidCategory = await Category.isActiveCategory(categoryIdNum);
            if (!isValidCategory) {
                return notFound(res, '指定的分类不存在或未启用');
            }

            // 验证分页参数
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
                return badRequest(res, '分页参数不正确');
            }

            // 构建过滤条件
            const filters = {};
            if (name && name.trim()) {
                filters.name = name.trim();
            }

            if (min_price) {
                const minPriceNum = parseFloat(min_price);
                if (!isNaN(minPriceNum) && minPriceNum >= 0) {
                    filters.min_price = minPriceNum;
                }
            }

            if (max_price) {
                const maxPriceNum = parseFloat(max_price);
                if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
                    filters.max_price = maxPriceNum;
                }
            }

            if (sort_by && ['price_asc', 'price_desc', 'view_count'].includes(sort_by)) {
                filters.sort_by = sort_by;
            }

            const merchantId = req.query.merchant_id || req.query.merchantId;
            if (merchantId && merchantId.toString().trim() !== '') {
                filters.merchant_id = merchantId.toString().trim();
            }

            // 获取该分类下的商品列表
            const result = await Product.getByCategory(categoryIdNum, pageNum, limitNum, filters);

            return success(res, result, '获取分类商品列表成功');
        } catch (err) {
            console.error('获取分类商品列表失败:', err);
            return error(res, '获取分类商品列表失败');
        }
    }

    /**
     * 获取热门商品
     */
    async getPopularProducts(req, res) {
        try {
            const { limit = 10 } = req.query;
            const limitNum = parseInt(limit);

            if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
                return badRequest(res, '数量限制参数不正确（1-50）');
            }

            const products = await Product.getPopular(limitNum);

            return success(res, { products }, '获取热门商品成功');
        } catch (err) {
            console.error('获取热门商品失败:', err);
            return error(res, '获取热门商品失败');
        }
    }

    /**
     * 搜索商品
     */
    async searchProducts(req, res) {
        try {
            const { keyword, page = 1, limit = 10 } = req.query;

            if (!keyword || keyword.trim() === '') {
                return badRequest(res, '搜索关键词不能为空');
            }

            // 验证分页参数
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
                return badRequest(res, '分页参数不正确');
            }

            const result = await Product.search(keyword.trim(), pageNum, limitNum);

            return success(res, result, '搜索商品成功');
        } catch (err) {
            console.error('搜索商品失败:', err);
            return error(res, '搜索商品失败');
        }
    }

    /**
     * 获取所有分类
     */
    async getCategories(req, res) {
        try {
            const { include_count = 'false' } = req.query;
            
            let categories;
            if (include_count === 'true') {
                // 获取分类及其商品数量
                categories = await Category.getCategoriesWithProductCount();
            } else {
                // 获取简单的分类列表
                categories = await Category.getActiveSimple();
            }

            return success(res, { categories }, '获取分类列表成功');
        } catch (err) {
            console.error('获取分类列表失败:', err);
            return error(res, '获取分类列表失败');
        }
    }

    /**
     * 获取分类详情及其商品预览
     */
    async getCategoryWithProducts(req, res) {
        try {
            const { id } = req.params;
            const { limit = 5 } = req.query;

            const categoryId = parseInt(id);
            const limitNum = parseInt(limit);

            if (isNaN(categoryId) || categoryId < 1) {
                return badRequest(res, '分类ID格式不正确');
            }

            if (isNaN(limitNum) || limitNum < 1 || limitNum > 20) {
                return badRequest(res, '商品数量限制参数不正确（1-20）');
            }

            const categoryWithProducts = await Category.getCategoryWithProducts(categoryId, limitNum);

            if (!categoryWithProducts) {
                return notFound(res, '分类不存在');
            }

            return success(res, categoryWithProducts, '获取分类详情成功');
        } catch (err) {
            console.error('获取分类详情失败:', err);
            return error(res, '获取分类详情失败');
        }
    }

    /**
     * 创建商品
     */
    async createProduct(req, res) {
        try {
            const productData = req.body;
            
            // 验证必需字段
            if (!productData.name || !productData.category_id || productData.price === undefined) {
                return badRequest(res, '商品名称、分类和价格不能为空');
            }

            // 验证分类是否存在
            const Category = require('../models/Category');
            const isValidCategory = await Category.isActiveCategory(parseInt(productData.category_id));
            if (!isValidCategory) {
                return badRequest(res, '无效的分类ID');
            }

            // 构建商品数据
            const fullProductData = {
                // 如果提供了merchant_id则使用，否则尝试从用户认证获取
                merchant_id: productData.merchant_id || (req.user ? req.user.id : 1),
                category_id: parseInt(productData.category_id),
                name: productData.name,
                description: productData.description || '',
                price: parseFloat(productData.price) || 0,
                image_url: productData.image_url || '',
                status: productData.status || 'active',
                sort_order: parseInt(productData.sort_order) || 0,
                stock: parseInt(productData.stock) || 0
            };

            // 如果提供了merchant_id，验证是否以MER开头，如果没有则自动添加
            if (fullProductData.merchant_id && !fullProductData.merchant_id.toString().startsWith('MER')) {
                fullProductData.merchant_id = 'MER' + fullProductData.merchant_id;
            }

            console.log('准备创建商品数据:', fullProductData);

            const product = await Product.create(fullProductData);

            return success(res, product, '商品创建成功');
        } catch (err) {
            console.error('创建商品失败:', err);
            return error(res, '创建商品失败: ' + err.message);
        }
    }

    /**
     * 更新商品（状态等）
     */
    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const productId = parseInt(id);
            if (isNaN(productId) || productId <= 0) {
                return badRequest(res, '商品ID格式不正确');
            }

            const merchantIdRaw = req.body.merchant_id || req.body.merchantId || req.query.merchant_id || req.user?.id;
            if (!merchantIdRaw) {
                return badRequest(res, '缺少商家ID');
            }

            let merchantId = merchantIdRaw.toString().trim();
            if (!merchantId.startsWith('MER')) {
                merchantId = 'MER' + merchantId;
            }

            const updateData = {};
            if (req.body.name !== undefined) updateData.name = req.body.name;
            if (req.body.price !== undefined) updateData.price = req.body.price;
            if (req.body.stock !== undefined) updateData.stock = req.body.stock;
            if (req.body.category_id !== undefined) updateData.category_id = req.body.category_id;
            if (req.body.description !== undefined) updateData.description = req.body.description;
            if (req.body.image_url !== undefined) updateData.image_url = req.body.image_url;
            if (req.body.sort_order !== undefined) updateData.sort_order = req.body.sort_order;
            if (req.body.status !== undefined) {
                const status = req.body.status;
                const validStatuses = ['active', 'inactive', 'sold_out'];
                if (!validStatuses.includes(status)) {
                    return badRequest(res, '无效的商品状态');
                }
                updateData.status = status;
            }

            if (Object.keys(updateData).length === 0) {
                return badRequest(res, '没有可更新的字段');
            }

            const result = await Product.update(productId, updateData, merchantId);
            return success(res, result, '商品更新成功');
        } catch (err) {
            console.error('更新商品失败:', err);
            if (err.message === '无权更新此商品') {
                return error(res, '无权更新此商品');
            }
            return error(res, '更新商品失败: ' + err.message);
        }
    }

    /**
     * 删除商品
     */
    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            const productId = parseInt(id);
            if (isNaN(productId) || productId <= 0) {
                return badRequest(res, '商品ID格式不正确');
            }

            const merchantIdRaw = req.body.merchant_id || req.body.merchantId || req.query.merchant_id || req.user?.id;
            if (!merchantIdRaw) {
                return badRequest(res, '缺少商家ID');
            }

            let merchantId = merchantIdRaw.toString().trim();
            if (!merchantId.startsWith('MER')) {
                merchantId = 'MER' + merchantId;
            }

            const result = await Product.delete(productId, merchantId);
            return success(res, null, result.message || '商品删除成功');
        } catch (err) {
            console.error('删除商品失败:', err);
            if (err.message === '商品不存在或无权限操作') {
                return notFound(res, err.message);
            }
            return error(res, '删除商品失败: ' + err.message);
        }
    }
}

module.exports = new ProductController();