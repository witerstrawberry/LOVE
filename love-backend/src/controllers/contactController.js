// 联系人控制器
const Contact = require('../models/Contact');
const { success, error, badRequest, notFound } = require('../utils/response');

class ContactController {
    /**
     * 创建新联系人
     */
    async createContact(req, res) {
        try {
            const userId = req.user.id;
            const { contact_user_id, contact_role_id, relationship, is_primary = false } = req.body;
            
            // 验证必填字段
            if (!contact_user_id || !contact_role_id || !relationship) {
                return badRequest(res, '缺少必填字段');
            }
            
            // 检查联系人是否已存在
            const exists = await Contact.exists(userId, contact_user_id);
            if (exists) {
                return badRequest(res, '该联系人已存在');
            }
            
            // 创建联系人
            const contact = await Contact.create({
                elderly_user_id: userId,
                contact_user_id,
                contact_role_id,
                relationship,
                is_primary
            });
            
            return success(res, contact, '创建联系人成功');
        } catch (err) {
            console.error('创建联系人失败:', err);
            return error(res, '创建联系人失败');
        }
    }
    
    /**
     * 获取联系人列表
     */
    async getContacts(req, res) {
        try {
            const userId = req.user.id;
            
            // 获取当前用户相关的所有联系人（无论是作为老人还是联系人）
            const contacts = await Contact.findByUserId(userId);
            
            return success(res, contacts, '获取联系人列表成功');
        } catch (err) {
            console.error('获取联系人列表失败:', err);
            return error(res, '获取联系人列表失败');
        }
    }
    
    /**
     * 获取联系人详情
     */
    async getContactById(req, res) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.id);
            
            // 获取联系人详情
            const contact = await Contact.findById(contactId);
            
            if (!contact) {
                return notFound(res, '联系人不存在');
            }
            
            // 验证权限（只有老人本人或联系人本人可以查看）
            if (contact.elderly_user_id !== userId && contact.contact_user_id !== userId) {
                return badRequest(res, '无权查看该联系人信息');
            }
            
            return success(res, contact, '获取联系人详情成功');
        } catch (err) {
            console.error('获取联系人详情失败:', err);
            return error(res, '获取联系人详情失败');
        }
    }
    
    /**
     * 更新联系人信息
     */
    async updateContact(req, res) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.id);
            const { relationship, is_primary } = req.body;
            
            // 获取联系人详情
            const contact = await Contact.findById(contactId);
            
            if (!contact) {
                return notFound(res, '联系人不存在');
            }
            
            // 验证权限（只有老人本人可以修改）
            if (contact.elderly_user_id !== userId) {
                return badRequest(res, '无权修改该联系人信息');
            }
            
            // 更新联系人
            const updatedContact = await Contact.update(contactId, {
                elderly_user_id: userId,
                relationship: relationship || contact.relationship,
                is_primary: is_primary !== undefined ? is_primary : contact.is_primary
            });
            
            return success(res, updatedContact, '更新联系人成功');
        } catch (err) {
            console.error('更新联系人失败:', err);
            return error(res, '更新联系人失败');
        }
    }
    
    /**
     * 删除联系人
     */
    async deleteContact(req, res) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.id);
            
            // 获取联系人详情
            const contact = await Contact.findById(contactId);
            
            if (!contact) {
                return notFound(res, '联系人不存在');
            }
            
            // 验证权限（只有老人本人可以删除）
            if (contact.elderly_user_id !== userId) {
                return badRequest(res, '无权删除该联系人信息');
            }
            
            // 删除联系人
            await Contact.delete(contactId);
            
            return success(res, null, '删除联系人成功');
        } catch (err) {
            console.error('删除联系人失败:', err);
            return error(res, '删除联系人失败');
        }
    }
    
    /**
     * 设置主要联系人
     */
    async setPrimaryContact(req, res) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.id);
            
            // 获取联系人详情
            const contact = await Contact.findById(contactId);
            
            if (!contact) {
                return notFound(res, '联系人不存在');
            }
            
            // 验证权限（只有老人本人可以设置）
            if (contact.elderly_user_id !== userId) {
                return badRequest(res, '无权设置主要联系人');
            }
            
            // 设置为主要联系人
            const updatedContact = await Contact.update(contactId, {
                elderly_user_id: userId,
                relationship: contact.relationship,
                is_primary: true
            });
            
            return success(res, updatedContact, '设置主要联系人成功');
        } catch (err) {
            console.error('设置主要联系人失败:', err);
            return error(res, '设置主要联系人失败');
        }
    }
    
    /**
     * 获取用户相关的所有联系人（无论是作为老人还是联系人）
     */
    async getAllRelatedContacts(req, res) {
        try {
            const userId = req.user.id;
            
            const contacts = await Contact.findByUserId(userId);
            
            return success(res, contacts, '获取相关联系人列表成功');
        } catch (err) {
            console.error('获取相关联系人列表失败:', err);
            return error(res, '获取相关联系人列表失败');
        }
    }
}

module.exports = new ContactController();