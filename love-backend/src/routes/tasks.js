const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const TaskController = require('../controllers/taskController');

router.use(authMiddleware.authenticateToken);

router.get('/volunteer/stats', async (req, res) => {
    try {
        await TaskController.getVolunteerStats(req, res);
    } catch (error) {
        console.error('获取志愿者统计信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取志愿者统计信息失败',
            error: error.message
        });
    }
});

router.get('/volunteer/list', async (req, res) => {
    try {
        await TaskController.getVolunteerAssignments(req, res);
    } catch (error) {
        console.error('获取志愿者任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取志愿者任务列表失败',
            error: error.message
        });
    }
});

router.post('/:id/claim', async (req, res) => {
    try {
        await TaskController.claimTask(req, res);
    } catch (error) {
        console.error('认领任务失败:', error);
        res.status(500).json({
            success: false,
            message: '认领任务失败',
            error: error.message
        });
    }
});

router.post('/:id/unclaim', async (req, res) => {
    try {
        await TaskController.unclaimTask(req, res);
    } catch (error) {
        console.error('取消认领失败:', error);
        res.status(500).json({
            success: false,
            message: '取消认领失败',
            error: error.message
        });
    }
});

// 测试接口：手动触发生成第二天的配送任务
// 注意：必须放在所有 /:id 路由之前，避免被误匹配
router.post('/test/generate', async (req, res) => {
    try {
        await TaskController.testGenerateTasks(req, res);
    } catch (error) {
        console.error('测试生成任务失败:', error);
        res.status(500).json({
            success: false,
            message: '测试生成任务失败',
            error: error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        await TaskController.getTaskList(req, res);
    } catch (error) {
        console.error('获取任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务列表失败',
            error: error.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        await TaskController.createTask(req, res);
    } catch (error) {
        console.error('创建任务失败:', error);
        res.status(500).json({
            success: false,
            message: '创建任务失败',
            error: error.message
        });
    }
});

router.get('/:id/user-relation', async (req, res) => {
    try {
        await TaskController.getUserTaskRelation(req, res);
    } catch (error) {
        console.error('获取任务关系失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务关系失败',
            error: error.message
        });
    }
});

router.get('/:id/orders', async (req, res) => {
    try {
        await TaskController.getTaskOrders(req, res);
    } catch (error) {
        console.error('获取任务关联订单失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务关联订单失败',
            error: error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        await TaskController.getTaskDetail(req, res);
    } catch (error) {
        console.error('获取任务详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务详情失败',
            error: error.message
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await TaskController.updateTask(req, res);
    } catch (error) {
        console.error('更新任务失败:', error);
        res.status(500).json({
            success: false,
            message: '更新任务失败',
            error: error.message
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await TaskController.deleteTask(req, res);
    } catch (error) {
        console.error('删除任务失败:', error);
        res.status(500).json({
            success: false,
            message: '删除任务失败',
            error: error.message
        });
    }
});

module.exports = router;

