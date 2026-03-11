const Favorite = require('../models/Favorite');
const Merchant = require('../models/Merchant');
const { success, error, badRequest, notFound } = require('../utils/response');

class FavoriteController {
    /**
     * 添加商家到收藏
     */
    async addFavorite(req, res) {
        try {
            const { merchantId } = req.body;
            const userId = req.user.id; // 从已验证的用户信息中获取用户ID
            
            // 验证商家ID
            if (!merchantId || typeof merchantId !== 'string') {
                return badRequest(res, '商家ID格式不正确');
            }
            
            // 验证商家是否存在
            const merchant = await Merchant.findByMerchantId(merchantId);
            if (!merchant) {
                return notFound(res, '商家不存在');
            }
            
            // 添加到收藏
            const favorite = await Favorite.add(userId, merchantId);
            
            return success(res, favorite, '收藏成功');
        } catch (err) {
            console.error('添加收藏失败:', err);
            if (err.message === '该商家已经在您的收藏列表中') {
                return badRequest(res, err.message);
            }
            return error(res, '添加收藏失败');
        }
    }

    /**
     * 取消收藏商家
     */
    async removeFavorite(req, res) {
        try {
            const { merchantId } = req.params;
            const userId = req.user.id;
            
            // 验证商家ID
            if (!merchantId || typeof merchantId !== 'string') {
                return badRequest(res, '商家ID格式不正确');
            }
            
            // 取消收藏
            const result = await Favorite.remove(userId, merchantId);
            
            if (!result) {
                return notFound(res, '收藏记录不存在');
            }
            
            return success(res, null, '取消收藏成功');
        } catch (err) {
            console.error('取消收藏失败:', err);
            return error(res, '取消收藏失败');
        }
    }

    /**
     * 获取用户的收藏列表
     */
    async getUserFavorites(req, res) {
        try {
            // 记录请求接收
            console.log('=== 收到获取收藏列表请求 ===');
            console.log('请求路径:', req.path);
            console.log('请求方法:', req.method);
            console.log('请求参数:', req.query);
            
            // 检查请求头
            console.log('Authorization头部:', req.headers.authorization);
            
            // 检查用户信息
            console.log('用户信息对象:', req.user);
            const userId = req.user.id;
            console.log('提取的用户ID:', userId, '类型:', typeof userId);
            
            // 解析分页参数
            const { page = 1, limit = 10 } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            
            console.log('解析后的参数 - page:', pageNum, 'limit:', limitNum);
            
            // 验证分页参数
            if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
                console.error('分页参数验证失败:', { page: pageNum, limit: limitNum });
                return badRequest(res, '分页参数不正确');
            }
            
            try {
                // 执行数据库查询
                console.log('调用Favorite.getListByUser方法，参数:', {
                    userId: userId,
                    pageNum: pageNum,
                    limitNum: limitNum
                });
                
                const result = await Favorite.getListByUser(userId, pageNum, limitNum);
                
                console.log('获取收藏列表成功，返回数据:', result);
                return success(res, result, '获取收藏列表成功');
            } catch (dbError) {
                console.error('数据库查询失败详细信息:', {
                    message: dbError.message,
                    stack: dbError.stack,
                    name: dbError.name
                });
                
                // 在开发环境下返回更详细的错误信息
                if (process.env.NODE_ENV === 'development') {
                    return error(res, `获取收藏列表失败: ${dbError.message}`);
                }
                return error(res, '获取收藏列表失败');
            }
        } catch (err) {
            console.error('获取收藏列表请求处理异常:', {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
            return error(res, '获取收藏列表失败');
        }
    }

    /**
     * 检查商家是否已收藏
     */
    async checkFavoriteStatus(req, res) {
        try {
            const { merchantId } = req.params;
            const userId = req.user.id;
            
            // 验证商家ID
            if (!merchantId || typeof merchantId !== 'string') {
                return badRequest(res, '商家ID格式不正确');
            }
            
            // 检查收藏状态
            const isFavorite = await Favorite.isFavorite(userId, merchantId);
            
            return success(res, { isFavorite }, '获取收藏状态成功');
        } catch (err) {
            console.error('检查收藏状态失败:', err);
            return error(res, '检查收藏状态失败');
        }
    }
}

module.exports = new FavoriteController();