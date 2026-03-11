const Notification = require('../models/Notification');
const Merchant = require('../models/Merchant');
const { success, error, badRequest, notFound } = require('../utils/response');

function normalizeMerchantId(merchantId) {
  if (!merchantId) return null;
  const id = merchantId.toString().trim();
  return id.startsWith('MER') ? id : `MER${id}`;
}

async function resolveMerchantId(req) {
  if (req.body && req.body.merchant_id) {
    return normalizeMerchantId(req.body.merchant_id);
  }
  if (req.query && req.query.merchant_id) {
    return normalizeMerchantId(req.query.merchant_id);
  }
  if (req.user && req.user.merchant_id) {
    return normalizeMerchantId(req.user.merchant_id);
  }
  if (req.user && req.user.id) {
    const merchant = await Merchant.findByUserId(req.user.id);
    if (merchant && merchant.id) {
      return normalizeMerchantId(merchant.id);
    }
  }
  return null;
}

exports.getNotifications = async (req, res) => {
  try {
    const merchantId = await resolveMerchantId(req);
    if (!merchantId) {
      return badRequest(res, '未找到商家信息，无法获取通知');
    }
    const includeSystem = req.query.include_system !== 'false';

    const notifications = await Notification.getMerchantNotifications(merchantId, includeSystem);
    return success(res, { notifications }, '获取通知成功');
  } catch (err) {
    console.error('获取通知失败:', err);
    return error(res, err.message || '获取通知失败');
  }
};

exports.getVolunteerNotifications = async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const notifications = await Notification.getVolunteerNotifications(limit);
    return success(res, { notifications }, '获取志愿者通知成功');
  } catch (err) {
    console.error('获取志愿者通知失败:', err);
    return error(res, err.message || '获取志愿者通知失败');
  }
};

exports.createNotification = async (req, res) => {
  try {
    const merchantId = await resolveMerchantId(req);
    if (!merchantId) {
      return badRequest(res, '未找到商家信息，无法发布通知');
    }

    const { title, content } = req.body;
    if (!title || !content) {
      return badRequest(res, '标题和内容不能为空');
    }

    const notification = await Notification.createNotification({
      merchantId,
      title: title.trim(),
      content: content.trim(),
      type: 'merchant'
    });

    return success(res, notification, '消息发布成功');
  } catch (err) {
    console.error('创建通知失败:', err);
    return error(res, err.message || '创建通知失败');
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const merchantId = await resolveMerchantId(req);
    if (!merchantId) {
      return badRequest(res, '未找到商家信息，无法更新通知');
    }

    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId) || notificationId <= 0) {
      return badRequest(res, '通知ID格式不正确');
    }

    const fields = {};
    ['title', 'content'].forEach(field => {
      if (req.body[field] !== undefined) {
        fields[field] = req.body[field];
      }
    });

    if (Object.keys(fields).length === 0) {
      return badRequest(res, '没有可以更新的字段');
    }

    const updated = await Notification.updateNotification(notificationId, merchantId, fields);
    return success(res, updated, '消息更新成功');
  } catch (err) {
    console.error('更新通知失败:', err);
    if (err.message === '通知不存在或无权限更新') {
      return notFound(res, err.message);
    }
    return error(res, err.message || '更新通知失败');
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const merchantId = await resolveMerchantId(req);
    if (!merchantId) {
      return badRequest(res, '未找到商家信息，无法删除通知');
    }

    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId) || notificationId <= 0) {
      return badRequest(res, '通知ID格式不正确');
    }

    await Notification.deleteNotification(notificationId, merchantId);
    return success(res, null, '消息已删除');
  } catch (err) {
    console.error('删除通知失败:', err);
    if (err.message === '通知不存在或无权限删除') {
      return notFound(res, err.message);
    }
    return error(res, err.message || '删除通知失败');
  }
};

