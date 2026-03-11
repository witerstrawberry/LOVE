// 志愿者控制器
const Volunteer = require('../models/Volunteer');
const Notification = require('../models/Notification');
const response = require('../utils/response');
const db = require('../config/database');

/**
 * 提交志愿者认证信息
 */
async function submitCertification(req, res) {
    try {
        const { user_id, real_name, id_card, gender, age, address, emergency_contact } = req.body;
        
        // 验证必填参数
        if (!user_id || !real_name || !id_card || !emergency_contact) {
            return response.badRequest(res, '请填写必填字段');
        }
        
        // 验证身份证号格式（简单验证）
        const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
        if (!idCardRegex.test(id_card)) {
            return response.badRequest(res, '身份证号格式不正确');
        }
        
        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(emergency_contact)) {
            return response.badRequest(res, '紧急联系人手机号格式不正确');
        }
        
        // 检查用户是否已有认证信息
        const existingVolunteer = await Volunteer.findOne({ user_id });
        
        if (existingVolunteer) {
            // 直接更新信息并视为通过
            await Volunteer.update(
                {
                    real_name,
                    id_card,
                    gender,
                    age,
                    address,
                    emergency_contact,
                    status: 1,
                    updated_at: new Date()
                },
                { user_id }
            );
            
            return response.success(res, null, '认证信息已保存');
        } else {
            try {
                // 创建新的志愿者记录
                await Volunteer.create({
                    user_id,
                    real_name,
                    id_card,
                    gender,
                    age,
                    address,
                    emergency_contact,
                    service_hours: 0,
                    status: 1,
                    created_at: new Date(),
                    updated_at: new Date()
                });
                
                return response.success(res, null, '认证信息提交成功');
            } catch (error) {
                // 检查是否是数据库唯一约束冲突（身份证号重复）
                if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
                    return response.conflict(res, '身份证号已被使用');
                }
                throw error;
            }
        }
    } catch (error) {
        console.error('提交认证失败:', error);
        return response.serverError(res, '服务器错误，请稍后重试');
    }
}

/**
 * 获取志愿者认证状态
 */
async function getCertificationStatus(req, res) {
    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return response.badRequest(res, '缺少用户ID');
        }
        
        // 查询志愿者信息
        const attributes = [
            'volunteer_id',
            'real_name',
            'id_card',
            'gender',
            'age',
            'address',
            'emergency_contact',
            'service_hours',
            'status',
            'created_at',
            'updated_at'
        ];
        
        const volunteerInfo = await Volunteer.findOneWithAttributes({ user_id }, attributes);
        
        if (!volunteerInfo) {
            // 返回空数据，表示未认证
            return response.success(res, null, '未查询到认证信息');
        }
        
        return response.success(res, volunteerInfo, '获取认证状态成功');
    } catch (error) {
        console.error('获取认证状态失败:', error);
        return response.serverError(res, '服务器错误，请稍后重试');
    }
}

/**
 * 更新志愿者认证信息
 */
async function updateCertification(req, res) {
    try {
        const { user_id, real_name, id_card, gender, age, address, emergency_contact } = req.body;
        
        // 验证必填参数
        if (!user_id || !real_name || !id_card || !emergency_contact) {
            return response.badRequest(res, '请填写必填字段');
        }
        
        // 查询现有认证信息
        const existingVolunteer = await Volunteer.findOne({ user_id });
        
        if (!existingVolunteer) {
            return response.notFound(res, '未查询到认证信息，请先提交认证');
        }
        
        // 验证身份证号格式
        const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
        if (!idCardRegex.test(id_card)) {
            return response.badRequest(res, '身份证号格式不正确');
        }
        
        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(emergency_contact)) {
            return response.badRequest(res, '紧急联系人手机号格式不正确');
        }
        
        try {
            // 更新认证信息
            await Volunteer.update(
                {
                    real_name,
                    id_card,
                    gender,
                    age,
                    address,
                    emergency_contact,
                    status: 1,
                    updated_at: new Date()
                },
                { user_id }
            );
            
            return response.success(res, null, '认证信息已更新');
        } catch (error) {
            // 检查是否是数据库唯一约束冲突（身份证号重复）
            if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
                return response.conflict(res, '身份证号已被使用');
            }
            throw error;
        }
    } catch (error) {
        console.error('更新认证失败:', error);
        return response.serverError(res, '服务器错误，请稍后重试');
    }
}

/**
 * 获取志愿者个人资料
 */
async function getVolunteerProfile(req, res) {
    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return response.badRequest(res, '缺少用户ID');
        }
        
        const volunteerInfo = await Volunteer.getFullProfileByUserId(user_id);
        
        if (!volunteerInfo) {
            return response.notFound(res, '未查询到志愿者信息');
        }
        
        return response.success(res, volunteerInfo, '获取志愿者资料成功');
    } catch (error) {
        console.error('获取志愿者资料失败:', error);
        return response.serverError(res, '服务器错误，请稍后重试');
    }
}

/**
 * 获取志愿者通知
 */
async function getVolunteerNotifications(req, res) {
    try {
        const limit = req.query.limit || 50;
        const notifications = await Notification.getVolunteerNotifications(limit);
        return response.success(res, { notifications }, '获取志愿者通知成功');
    } catch (error) {
        console.error('获取志愿者通知失败:', error);
        return response.serverError(res, '获取志愿者通知失败');
    }
}

module.exports = {
    submitCertification,
    getCertificationStatus,
    updateCertification,
    getVolunteerProfile,
    getVolunteerNotifications
};