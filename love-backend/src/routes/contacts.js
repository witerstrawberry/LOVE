// 联系人路由
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Contacts
 *   description: 联系人管理相关接口
 */

/**
 * @swagger
 * /contacts:
 *   post:
 *     summary: 创建新联系人
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_user_id:
 *                 type: integer
 *                 description: 联系人用户ID
 *               contact_role_id:
 *                 type: integer
 *                 description: 联系人角色ID
 *               relationship:
 *                 type: string
 *                 description: 关系描述
 *               is_primary:
 *                 type: boolean
 *                 description: 是否为主要联系人
 *     responses:
 *       200:
 *         description: 创建成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
router.post('/', authenticateToken, contactController.createContact);

/**
 * @swagger
 * /contacts:
 *   get:
 *     summary: 获取当前用户的联系人列表
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 */
router.get('/', authenticateToken, contactController.getContacts);

/**
 * @swagger
 * /contacts/all:
 *   get:
 *     summary: 获取用户相关的所有联系人（作为老人或联系人）
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 */
router.get('/all', authenticateToken, contactController.getAllRelatedContacts);

/**
 * @swagger
 * /contacts/{id}:
 *   get:
 *     summary: 获取联系人详情
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 联系人ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 *       404:
 *         description: 联系人不存在
 */
router.get('/:id', authenticateToken, contactController.getContactById);

/**
 * @swagger
 * /contacts/{id}:
 *   put:
 *     summary: 更新联系人信息
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 联系人ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               relationship:
 *                 type: string
 *                 description: 关系描述
 *               is_primary:
 *                 type: boolean
 *                 description: 是否为主要联系人
 *     responses:
 *       200:
 *         description: 更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       404:
 *         description: 联系人不存在
 */
router.put('/:id', authenticateToken, contactController.updateContact);

/**
 * @swagger
 * /contacts/{id}:
 *   delete:
 *     summary: 删除联系人
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 联系人ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *       401:
 *         description: 未授权
 *       404:
 *         description: 联系人不存在
 */
router.delete('/:id', authenticateToken, contactController.deleteContact);

/**
 * @swagger
 * /contacts/{id}/primary:
 *   patch:
 *     summary: 设置为主要联系人
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 联系人ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 设置成功
 *       401:
 *         description: 未授权
 *       404:
 *         description: 联系人不存在
 */
router.patch('/:id/primary', authenticateToken, contactController.setPrimaryContact);

module.exports = router;