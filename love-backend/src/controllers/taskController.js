const Task = require('../models/Task');
const TaskVolunteer = require('../models/TaskVolunteer');
const Volunteer = require('../models/Volunteer');
const Merchant = require('../models/Merchant');
const TaskAcceptLimit = require('../models/TaskAcceptLimit');
const taskScheduler = require('../services/taskScheduler');
const db = require('../config/database');
const response = require('../utils/response');

async function resolveVolunteerId(userId) {
    if (!userId) return null;
    const volunteer = await Volunteer.findOne({ user_id: userId });
    return volunteer ? volunteer.volunteer_id : null;
}

async function resolveMerchantId(userId) {
    if (!userId) return null;
    const merchant = await Merchant.findByUserId(userId);
    return merchant ? merchant.id : null;
}

async function getTaskList(req, res) {
    try {
        const scope = req.query.scope || 'all';
        let volunteerId = null;
        let merchantId = null;

        if (req.user && req.user.role_id === 3) {
            volunteerId = await resolveVolunteerId(req.user.id);
        }

        if (scope === 'mine' && req.user && req.user.role_id === 2) {
            merchantId = await resolveMerchantId(req.user.id);
            if (!merchantId) {
                return response.badRequest(res, '未找到商家信息，无法获取任务');
            }
        }

        const tasks = await Task.getTaskList({ volunteerId, merchantId });
        return response.success(res, { tasks }, '获取任务列表成功');
    } catch (error) {
        console.error('获取任务列表失败:', error);
        return response.serverError(res, '获取任务列表失败');
    }
}

async function getTaskDetail(req, res) {
    try {
        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
            return response.badRequest(res, '任务ID格式不正确');
        }

        const task = await Task.getTaskById(taskId);
        if (!task) {
            return response.notFound(res, '未找到任务');
        }

        return response.success(res, task, '获取任务详情成功');
    } catch (error) {
        console.error('获取任务详情失败:', error);
        return response.serverError(res, '获取任务详情失败');
    }
}

async function getTaskOrders(req, res) {
    try {
        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
            return response.badRequest(res, '任务ID格式不正确');
        }

        const task = await Task.getTaskById(taskId);
        if (!task) {
            return response.notFound(res, '未找到任务');
        }

        const orders = await Task.getTaskOrders(taskId);
        return response.success(res, { task, orders }, '获取任务关联订单成功');
    } catch (error) {
        console.error('获取任务关联订单失败:', error);
        return response.serverError(res, '获取任务关联订单失败');
    }
}

async function getUserTaskRelation(req, res) {
    try {
        if (!req.user || req.user.role_id !== 3) {
            return response.forbidden(res, '只有志愿者可以查看任务关系');
        }

        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
            return response.badRequest(res, '任务ID格式不正确');
        }

        const volunteerId = await resolveVolunteerId(req.user.id);
        if (!volunteerId) {
            return response.badRequest(res, '未找到志愿者信息，请先完成认证');
        }

        const isClaimed = await TaskVolunteer.hasUserClaimedTask(taskId, volunteerId);

        return response.success(res, { isClaimed }, '获取任务关系成功');
    } catch (error) {
        console.error('获取用户任务关系失败:', error);
        return response.serverError(res, '获取用户任务关系失败');
    }
}

async function createTask(req, res) {
    try {
        if (!req.user || req.user.role_id !== 2) {
            return response.forbidden(res, '只有商家可以发布任务');
        }

        const merchantId = await resolveMerchantId(req.user.id);
        if (!merchantId) {
            return response.badRequest(res, '未找到商家信息，无法发布任务');
        }

        const {
            contact_name,
            contact_phone,
            task_title,
            task_content,
            task_type,
            require_num,
            start_time,
            end_time,
            address,
            status = 1
        } = req.body;

        if (!task_title || !task_content || !task_type || !require_num || !start_time || !end_time || !address) {
            return response.badRequest(res, '请填写完整的任务信息');
        }

        const taskData = {
            merchant_id: merchantId,
            contact_name,
            contact_phone,
            task_title,
            task_content,
            task_type,
            require_num,
            start_time,
            end_time,
            address,
            status
        };

        const newTask = await Task.createTask(taskData);
        return response.success(res, newTask, '任务创建成功');
    } catch (error) {
        console.error('创建任务失败:', error);
        return response.serverError(res, '创建任务失败');
    }
}

async function updateTask(req, res) {
    try {
        if (!req.user || req.user.role_id !== 2) {
            return response.forbidden(res, '只有商家可以更新任务');
        }

        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
            return response.badRequest(res, '任务ID格式不正确');
        }

        const merchantId = await resolveMerchantId(req.user.id);
        if (!merchantId) {
            return response.badRequest(res, '未找到商家信息，无法更新任务');
        }

        const success = await Task.updateTask(taskId, merchantId, req.body || {});
        if (!success) {
            return response.notFound(res, '任务不存在或无权限更新');
        }

        return response.success(res, null, '任务更新成功');
    } catch (error) {
        console.error('更新任务失败:', error);
        return response.serverError(res, '更新任务失败');
    }
}

async function deleteTask(req, res) {
    try {
        if (!req.user || req.user.role_id !== 2) {
            return response.forbidden(res, '只有商家可以删除任务');
        }

        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
            return response.badRequest(res, '任务ID格式不正确');
        }

        const merchantId = await resolveMerchantId(req.user.id);
        if (!merchantId) {
            return response.badRequest(res, '未找到商家信息，无法删除任务');
        }

        const success = await Task.deleteTask(taskId, merchantId);
        if (!success) {
            return response.notFound(res, '任务不存在或无权限删除');
        }

        return response.success(res, null, '任务删除成功');
    } catch (error) {
        console.error('删除任务失败:', error);
        return response.serverError(res, '删除任务失败');
    }
}

async function claimTask(req, res) {
    try {
        if (!req.user || req.user.role_id !== 3) {
            return response.forbidden(res, '只有志愿者可以认领任务');
        }

        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
            return response.badRequest(res, '任务ID格式不正确');
        }

        const volunteerId = await resolveVolunteerId(req.user.id);
        if (!volunteerId) {
            return response.badRequest(res, '未找到志愿者信息，请先完成认证');
        }

        const task = await Task.getTaskById(taskId);
        if (!task) {
            return response.notFound(res, '任务不存在');
        }

        if (task.status >= 3) {
            return response.conflict(res, '任务已结束或不可认领');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 锁定任务接单限制
            const limit = await TaskAcceptLimit.getByTaskId(taskId, { connection, forUpdate: true });
            if (!limit) {
                throw new Error('任务接单限制未初始化');
            }

            if (limit.current_accept_num >= limit.require_num) {
                await connection.rollback();
                return response.conflict(res, '任务可接取名额已满');
            }

            // 检查是否已接取
            const [existing] = await connection.execute(
                'SELECT 1 FROM task_volunteer WHERE task_id = ? AND volunteer_id = ? AND status IN (1,2) LIMIT 1',
                [taskId, volunteerId]
            );
            if (existing.length > 0) {
                await connection.rollback();
                return response.conflict(res, '您已认领过该任务');
            }

            await TaskVolunteer.claimTask(taskId, volunteerId, connection);
            await TaskAcceptLimit.increment(taskId, connection);

            await connection.commit();
        return response.success(res, null, '任务认领成功');
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('认领任务失败:', error);
        if (error.message === '您已认领过该任务') {
            return response.conflict(res, error.message);
        }
        return response.serverError(res, '认领任务失败');
    }
}

async function unclaimTask(req, res) {
    try {
        if (!req.user || req.user.role_id !== 3) {
            return response.forbidden(res, '只有志愿者可以取消认领');
        }

        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId) || taskId <= 0) {
            return response.badRequest(res, '任务ID格式不正确');
        }

        const volunteerId = await resolveVolunteerId(req.user.id);
        if (!volunteerId) {
            return response.badRequest(res, '未找到志愿者信息，请先完成认证');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 检查是否有正在配送的订单
            const [assignedOrders] = await connection.execute(
                `SELECT order_id 
                 FROM order_volunteer 
                 WHERE task_id = ? 
                   AND volunteer_id = ? 
                   AND status IN ('accepted','picked') 
                 LIMIT 1`,
                [taskId, volunteerId]
            );
            if (assignedOrders.length > 0) {
                await connection.rollback();
                return response.conflict(res, '您仍有订单在配送中，无法取消认领');
            }

            await TaskVolunteer.unclaimTask(taskId, volunteerId, connection);
            await TaskAcceptLimit.decrement(taskId, connection);

            await connection.commit();
        return response.success(res, null, '已取消任务认领');
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('取消认领失败:', error);
        if (error.message === '未找到可取消的认领记录') {
            return response.notFound(res, error.message);
        }
        return response.serverError(res, '取消认领失败');
    }
}

async function getVolunteerStats(req, res) {
    try {
        if (!req.user || req.user.role_id !== 3) {
            return response.forbidden(res, '只有志愿者可以查看统计信息');
        }

        const volunteerId = await resolveVolunteerId(req.user.id);
        if (!volunteerId) {
            return response.badRequest(res, '未找到志愿者信息，请先完成认证');
        }

        const stats = await TaskVolunteer.getStatsByVolunteer(volunteerId);
        return response.success(res, stats, '获取志愿者统计信息成功');
    } catch (error) {
        console.error('获取志愿者统计信息失败:', error);
        return response.serverError(res, '获取志愿者统计信息失败');
    }
}

async function getVolunteerAssignments(req, res) {
    try {
        if (!req.user || req.user.role_id !== 3) {
            return response.forbidden(res, '只有志愿者可以查看任务列表');
        }

        const volunteerId = await resolveVolunteerId(req.user.id);
        if (!volunteerId) {
            return response.badRequest(res, '未找到志愿者信息，请先完成认证');
        }

        const assignments = await TaskVolunteer.getTasksWithDetails(volunteerId);
        return response.success(res, assignments, '获取志愿者任务列表成功');
    } catch (error) {
        console.error('获取志愿者任务列表失败:', error);
        return response.serverError(res, '获取志愿者任务列表失败');
    }
}

/**
 * 测试接口：手动触发生成第二天的配送任务
 * 用于测试定时任务功能
 */
async function testGenerateTasks(req, res) {
    try {
        console.log('手动触发生成配送任务...');
        
        // 调用任务调度器的生成方法
        await taskScheduler.generateTasksManually();
        
        return response.success(res, null, '配送任务生成成功');
    } catch (error) {
        console.error('生成配送任务失败:', error);
        return response.serverError(res, '生成配送任务失败: ' + error.message);
    }
}

module.exports = {
    getTaskList,
    getTaskDetail,
    getTaskOrders,
    getUserTaskRelation,
    createTask,
    updateTask,
    deleteTask,
    claimTask,
    unclaimTask,
    getVolunteerStats,
    getVolunteerAssignments,
    testGenerateTasks
};

