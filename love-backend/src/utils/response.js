/**
 * 统一API响应格式
 */

// 成功响应
const success = (res, data = null, message = '操作成功', code = 200) => {
  return res.status(code).json({
    success: true,
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

// 错误响应
const error = (res, message = '操作失败', code = 400, data = null) => {
  return res.status(code).json({
    success: false,
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

// 分页响应
const paginated = (res, data, pagination, message = '获取成功') => {
  return res.json({
    success: true,
    code: 200,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit)
    },
    timestamp: new Date().toISOString()
  });
};

// 常用错误响应
const badRequest = (res, message = '请求参数错误') => {
  return error(res, message, 400);
};

const unauthorized = (res, message = '未授权访问') => {
  return error(res, message, 401);
};

const forbidden = (res, message = '禁止访问') => {
  return error(res, message, 403);
};

const notFound = (res, message = '资源不存在') => {
  return error(res, message, 404);
};

const conflict = (res, message = '资源冲突') => {
  return error(res, message, 409);
};

const serverError = (res, message = '服务器内部错误') => {
  return error(res, message, 500);
};

module.exports = {
  success,
  error,
  paginated,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError
};