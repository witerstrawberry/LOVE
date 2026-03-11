const ElderlyInfo = require('../models/ElderlyInfo');
const { success, error, badRequest, notFound } = require('../utils/response');

class ElderlyInfoController {
    /**
     * 新增老人健康信息
     */
    async createElderlyInfo(req, res) {
        try {
            const childId = req.body.child_id || req.user?.id;
            if (!childId) {
                return badRequest(res, '缺少child_id，无法关联上传人');
            }

            const payload = {
                user_id: req.body.user_id || null,
                user_name: req.body.user_name || null,
                user_old_phone: req.body.user_old_phone || null,
                child_id: childId,
                relative_relation: req.body.relative_relation,
                is_common_order: req.body.is_common_order,
                blood_sugar: req.body.blood_sugar,
                blood_pressure: req.body.blood_pressure,
                allergen: req.body.allergen,
                diet_forbidden: req.body.diet_forbidden
            };

            const record = await ElderlyInfo.create(payload);
            return success(res, record, '新增老人信息成功');
        } catch (err) {
            console.error('新增老人信息失败:', err);
            return error(res, '新增老人信息失败，请稍后重试', 500);
        }
    }

    /**
     * 获取老人信息列表
     */
    async getElderlyInfos(req, res) {
        try {
            const { childId, userId, page = 1, pageSize = 10 } = req.query;
            const list = await ElderlyInfo.list({
                childId: childId || req.user?.id,
                userId,
                page,
                pageSize
            });

            return success(res, list, '获取老人信息列表成功');
        } catch (err) {
            console.error('获取老人信息列表失败:', err);
            return error(res, '获取老人信息列表失败', 500);
        }
    }

    /**
     * 获取老人信息详情
     */
    async getElderlyInfoById(req, res) {
        try {
            const record = await ElderlyInfo.findById(req.params.id);
            if (!record) {
                return notFound(res, '老人信息不存在');
            }

            return success(res, record, '获取老人信息成功');
        } catch (err) {
            console.error('查询老人信息失败:', err);
            return error(res, '查询老人信息失败', 500);
        }
    }

    /**
     * 更新老人信息
     */
    async updateElderlyInfo(req, res) {
        try {
            const record = await ElderlyInfo.findById(req.params.id);
            if (!record) {
                return notFound(res, '老人信息不存在');
            }

            const updated = await ElderlyInfo.update(req.params.id, req.body);
            return success(res, updated, '更新老人信息成功');
        } catch (err) {
            console.error('更新老人信息失败:', err);
            return error(res, '更新老人信息失败', 500);
        }
    }

    /**
     * 删除老人信息
     */
    async deleteElderlyInfo(req, res) {
        try {
            const record = await ElderlyInfo.findById(req.params.id);
            if (!record) {
                return notFound(res, '老人信息不存在');
            }

            await ElderlyInfo.delete(req.params.id);
            return success(res, null, '删除老人信息成功');
        } catch (err) {
            console.error('删除老人信息失败:', err);
            return error(res, '删除老人信息失败', 500);
        }
    }

    /**
     * 根据child_id统计数量
     */
    async countByChildId(req, res) {
        try {
            const childId = req.params.childId || req.query.childId || req.user?.id;
            if (!childId) {
                return badRequest(res, '缺少childId参数');
            }

            const normalizedChildId = parseInt(childId, 10);
            if (Number.isNaN(normalizedChildId)) {
                return badRequest(res, 'childId必须是数字');
            }

            const total = await ElderlyInfo.countByChildId(normalizedChildId);
            return success(res, { childId: normalizedChildId, total }, '统计成功');
        } catch (err) {
            console.error('统计child_id数量失败:', err);
            return error(res, '统计失败', 500);
        }
    }

    /**
     * 根据user_id统计数量
     */
    async countByUserId(req, res) {
        try {
            const userId = req.params.userId || req.query.userId;
            if (!userId) {
                return badRequest(res, '缺少userId参数');
            }

            const normalizedUserId = parseInt(userId, 10);
            if (Number.isNaN(normalizedUserId)) {
                return badRequest(res, 'userId必须是数字');
            }

            const total = await ElderlyInfo.countByUserId(normalizedUserId);
            return success(res, { userId: normalizedUserId, total }, '统计成功');
        } catch (err) {
            console.error('统计user_id数量失败:', err);
            return error(res, '统计失败', 500);
        }
    }
}

module.exports = new ElderlyInfoController();

