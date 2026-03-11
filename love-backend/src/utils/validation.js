/**
 * 数据验证工具函数
 */

// 验证手机号
const isValidPhone = (phone) => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

// 验证邮箱
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// 验证密码强度（6-20位）
const isValidPassword = (password) => {
  return password && password.length >= 6 && password.length <= 20;
};

// 验证微信openid格式
const isValidOpenId = (openid) => {
  return typeof openid === 'string' && openid.length > 0;
};

// 验证分页参数
const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  
  return {
    page: Math.max(1, pageNum),
    limit: Math.min(Math.max(1, limitNum), 100), // 限制最大100条
    offset: (Math.max(1, pageNum) - 1) * Math.min(Math.max(1, limitNum), 100)
  };
};

// 验证价格格式
const isValidPrice = (price) => {
  const priceNum = parseFloat(price);
  return !isNaN(priceNum) && priceNum >= 0;
};

// 验证日期格式 (YYYY-MM-DD)
const isValidDate = (dateString) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// 验证必填字段
const validateRequired = (fields, data) => {
  const missing = [];
  
  for (const field of fields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing
  };
};

// 清理和转义字符串
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

// 验证图片文件类型
const isValidImageType = (mimetype) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return allowedTypes.includes(mimetype);
};

module.exports = {
  isValidPhone,
  isValidEmail,
  isValidPassword,
  isValidOpenId,
  validatePagination,
  isValidPrice,
  isValidDate,
  validateRequired,
  sanitizeString,
  isValidImageType
};