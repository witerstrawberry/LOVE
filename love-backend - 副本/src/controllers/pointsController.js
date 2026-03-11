// 积分控制器
const UserPoints = require('../models/UserPoints');
const { success, error, unauthorized } = require('../utils/response');

class PointsController {
    /**
     * 获取用户积分余额
     */
    async getUserPointsBalance(req, res) {
        try {
            const userId = req.user.id;
            
            // 获取用户积分信息
            let pointsInfo = null;
            try {
                pointsInfo = await UserPoints.findByUserId(userId);
            } catch (pointsError) {
                console.warn('获取用户积分信息时出现错误:', pointsError);
            }
            
            // 构造返回数据
            const data = {
                balance: pointsInfo && pointsInfo.available_points !== undefined ? pointsInfo.available_points : 0,
                total: pointsInfo && pointsInfo.total_points !== undefined ? pointsInfo.total_points : 0,
                expired: pointsInfo && pointsInfo.expired_points !== undefined ? pointsInfo.expired_points : 0
            };
            
            return success(res, data, '获取积分余额成功');
            
        } catch (err) {
            console.error('获取积分余额失败:', err);
            return error(res, '获取积分余额失败');
        }
    }
    
    /**
     * 获取用户积分信息
     */
    async getUserPoints(req, res) {
        try {
            const userId = req.user.id;
            
            // 获取用户积分信息
            let pointsInfo = null;
            try {
                pointsInfo = await UserPoints.findByUserId(userId);
            } catch (pointsError) {
                console.warn('获取用户积分信息时出现错误:', pointsError);
            }
            
            // 构造返回数据
            const data = {
                available_points: pointsInfo && pointsInfo.available_points !== undefined ? pointsInfo.available_points : 0,
                total_points: pointsInfo && pointsInfo.total_points !== undefined ? pointsInfo.total_points : 0,
                expired_points: pointsInfo && pointsInfo.expired_points !== undefined ? pointsInfo.expired_points : 0
            };
            
            return success(res, data, '获取积分信息成功');
            
        } catch (err) {
            console.error('获取积分信息失败:', err);
            return error(res, '获取积分信息失败');
        }
    }
    
    /**
     * 获取积分历史记录
     */
    async getPointsHistory(req, res) {
        try {
            // 这里应该实现获取积分历史记录的逻辑
            // 暂时返回空数据
            return success(res, [], '获取积分历史记录成功');
        } catch (err) {
            console.error('获取积分历史记录失败:', err);
            return error(res, '获取积分历史记录失败');
        }
    }
    
    /**
     * 获取用户积分详情
     */
    async getPointsDetails(req, res) {
        try {
            // 获取查询参数中的userId
            let targetUserId = req.query.userId;
            const currentUserId = req.user.id;
            
            // 如果没有提供userId，或者提供的userId与当前用户不匹配，则使用当前用户的ID
            const userId = (!targetUserId || parseInt(targetUserId) !== currentUserId) ? currentUserId : parseInt(targetUserId);
            
            // 获取用户积分信息
            let pointsInfo = null;
            try {
                pointsInfo = await UserPoints.findByUserId(userId);
            } catch (pointsError) {
                console.warn('获取用户积分信息时出现错误:', pointsError);
            }
            
            // 构造返回数据
            const data = {
                available_points: pointsInfo && pointsInfo.available_points !== undefined ? pointsInfo.available_points : 0,
                total_points: pointsInfo && pointsInfo.total_points !== undefined ? pointsInfo.total_points : 0,
                expired_points: pointsInfo && pointsInfo.expired_points !== undefined ? pointsInfo.expired_points : 0
            };
            
            return success(res, data, '获取积分详情成功');
            
        } catch (err) {
            console.error('获取积分详情失败:', err);
            return error(res, '获取积分详情失败');
        }
    }
    
    /**
     * 使用积分支付
     */
    async payWithPoints(req, res) {
        try {
            // 这里应该实现使用积分支付的逻辑
            // 暂时返回成功响应
            return success(res, { success: true }, '积分支付成功');
        } catch (err) {
            console.error('积分支付失败:', err);
            return error(res, '积分支付失败');
        }
    }
}

module.exports = new PointsController();