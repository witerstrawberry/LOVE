const User = require('../models/User');
const Merchant = require('../models/Merchant');
const Notification = require('../models/Notification');
const { success, error, badRequest, notFound } = require('../utils/response');

/**
 * 管理员获取用户列表
 * 支持分页与简单筛选
 */
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.phone) {
      filters.phone = req.query.phone;
    }
    if (req.query.nickname) {
      filters.nickname = req.query.nickname;
    }

    const result = await User.getList(page, limit, filters);

    return success(res, result, '获取用户列表成功');
  } catch (err) {
    console.error('管理员获取用户列表失败:', err);
    return error(res, err.message || '获取用户列表失败');
  }
};

/**
 * 管理员更新用户账户状态
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId) || userId <= 0) {
      return badRequest(res, '用户ID格式不正确');
    }

    const { status } = req.body;
    const allowedStatus = ['active', 'inactive', 'banned'];
    if (!status || !allowedStatus.includes(status)) {
      return badRequest(res, '状态值不正确，只能为 active、inactive 或 banned');
    }

    const updated = await User.update(userId, { status });
    if (!updated) {
      return notFound(res, '用户不存在');
    }

    return success(res, { id: userId, status }, '更新用户状态成功');
  } catch (err) {
    console.error('管理员更新用户状态失败:', err);
    return error(res, err.message || '更新用户状态失败');
  }
};

/**
 * 管理员获取商家列表
 * 仅用于后台管理展示
 */
exports.getMerchants = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const result = await Merchant.findAll({ page, limit });

    return success(res, result, '获取商家列表成功');
  } catch (err) {
    console.error('管理员获取商家列表失败:', err);
    return error(res, err.message || '获取商家列表失败');
  }
};

/**
 * 管理员更新商家营业状态
 */
exports.updateMerchantStatus = async (req, res) => {
  try {
    const merchantId = req.params.id;
    if (!merchantId) {
      return badRequest(res, '缺少商家ID');
    }

    const { is_open } = req.body;
    if (is_open === undefined || (is_open !== 0 && is_open !== 1 && is_open !== '0' && is_open !== '1')) {
      return badRequest(res, '营业状态不正确，只能为0或1');
    }

    const normalizedIsOpen = parseInt(is_open, 10) === 1 ? 1 : 0;

    const updated = await Merchant.updateStatusByMerchantId(merchantId, normalizedIsOpen);
    if (!updated || !updated.success) {
      return error(res, updated?.message || '更新商家状态失败');
    }

    return success(res, { id: merchantId, is_open: normalizedIsOpen }, '更新商家状态成功');
  } catch (err) {
    console.error('管理员更新商家状态失败:', err);
    return error(res, err.message || '更新商家状态失败');
  }
};

/**
 * 管理员发布系统通知（发布人固定为系统）
 */
exports.createSystemNotification = async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return badRequest(res, '标题和内容不能为空');
    }

    const notification = await Notification.createNotification({
      merchantId: null,
      title: title.trim(),
      content: content.trim(),
      type: 'system'
    });

    return success(res, notification, '系统消息发布成功');
  } catch (err) {
    console.error('管理员创建系统通知失败:', err);
    return error(res, err.message || '创建系统通知失败');
  }
};

/**
 * 管理员删除系统通知
 */
exports.deleteSystemNotification = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return badRequest(res, '通知ID格式不正确');
    }

    await Notification.deleteSystemNotification(id);

    return success(res, { id }, '系统通知删除成功');
  } catch (err) {
    console.error('管理员删除系统通知失败:', err);
    return error(res, err.message || '删除系统通知失败');
  }
};


