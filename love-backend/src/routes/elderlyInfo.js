const express = require('express');
const router = express.Router();
const elderlyInfoController = require('../controllers/elderlyInfoController');
const { authenticateToken } = require('../middleware/auth');

// 统计接口需要放在动态ID路由之前
router.get('/stats/child', authenticateToken, (req, res) =>
    elderlyInfoController.countByChildId(req, res)
);
router.get('/stats/child/:childId', authenticateToken, (req, res) =>
    elderlyInfoController.countByChildId(req, res)
);
router.get('/stats/user/:userId', authenticateToken, (req, res) =>
    elderlyInfoController.countByUserId(req, res)
);

// CRUD
router.post('/', authenticateToken, (req, res) =>
    elderlyInfoController.createElderlyInfo(req, res)
);

router.get('/', authenticateToken, (req, res) =>
    elderlyInfoController.getElderlyInfos(req, res)
);

router.get('/:id', authenticateToken, (req, res) =>
    elderlyInfoController.getElderlyInfoById(req, res)
);

router.put('/:id', authenticateToken, (req, res) =>
    elderlyInfoController.updateElderlyInfo(req, res)
);

router.delete('/:id', authenticateToken, (req, res) =>
    elderlyInfoController.deleteElderlyInfo(req, res)
);

module.exports = router;

