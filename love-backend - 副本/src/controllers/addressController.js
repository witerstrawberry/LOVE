// 地址控制器
const { success, error } = require('../utils/response');
const User = require('../models/User');
const Address = require('../models/Address');

class AddressController {
  // 获取用户地址列表
  static async getUserAddresses(req, res) {
    try {
      // 从查询参数或用户会话中获取用户ID
      // 优先从查询参数获取userId，取消强制登录验证
      let userId = req.query.userId;
      
      // 如果查询参数中没有userId，则尝试从用户会话中获取
      if (!userId && req.user && req.user.id) {
        userId = req.user.id;
      }
      
      // 如果仍然没有userId，返回错误
      if (!userId) {
        return error(res, '用户ID不能为空', 400);
      }
      
      // 确保userId是数字类型
      userId = parseInt(userId);
      if (isNaN(userId)) {
        return error(res, '用户ID格式不正确', 400);
      }
      
      // 获取分页参数
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      
      // 使用Address模型获取用户地址列表
      const addresses = await Address.getAddressesByUserId(userId);
      
      const total = addresses.length;
      
      // 分页处理
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedAddresses = addresses.slice(startIndex, endIndex);
      
      // 格式化地址数据，使其与前端期望的格式匹配
      const formattedAddresses = paginatedAddresses.map(address => ({
        id: address.id,
        name: address.recipient_name, // 前端期望的字段名是name
        phone: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        detail: address.detail_address, // 前端期望的字段名是detail
        is_default: address.is_default === 1,
        created_at: address.created_at,
        updated_at: address.updated_at
      }));
      
      return success(res, { list: formattedAddresses, total, page, pageSize });
    } catch (err) {
      console.error('获取用户地址列表失败:', err);
      return error(res, '获取地址列表失败', 500);
    }
  }
  
  // 获取单个地址详情
  static async getAddressById(req, res) {
    try {
      // 从请求中获取用户ID
      if (!req.user || !req.user.id) {
        return error(res, '用户未登录', 401);
      }
      const userId = req.user.id;
      
      const addressId = req.params.id;
      
      // 使用Address模型获取地址详情
      const address = await Address.getAddressById(addressId);
      
      if (!address || address.user_id !== userId) {
        return error(res, '地址不存在', 404);
      }
      
      // 格式化地址数据
      const formattedAddress = {
        id: address.id,
        name: address.recipient_name,
        phone: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        detail: address.detail_address,
        is_default: address.is_default === 1,
        created_at: address.created_at,
        updated_at: address.updated_at
      };
      
      return success(res, formattedAddress);
    } catch (err) {
      console.error('获取地址详情失败:', err);
      return error(res, '获取地址详情失败', 500);
    }
  }
  
  // 添加新地址
  static async addAddress(req, res) {
    try {
      // 从请求体或用户会话中获取用户ID
      // 优先从请求体获取userId，取消强制登录验证
      let userId = req.body.userId;
      
      // 如果请求体中没有userId，则尝试从用户会话中获取
      if (!userId && req.user && req.user.id) {
        userId = req.user.id;
      }
      
      // 如果仍然没有userId，返回错误
      if (!userId) {
        return error(res, '用户ID不能为空', 400);
      }
      
      // 确保userId是数字类型
      userId = parseInt(userId);
      if (isNaN(userId)) {
        return error(res, '用户ID格式不正确', 400);
      }
      
      const { name, phone, province, city, district, detail, is_default } = req.body;
      
      // 验证必填字段
      if (!name || !phone || !province || !city || !district || !detail) {
        return error(res, '请填写完整的地址信息', 400);
      }
      
      // 准备地址数据
      const addressData = {
        user_id: userId,
        recipient_name: name,
        phone,
        province,
        city,
        district,
        detail_address: detail,
        is_default: is_default ? 1 : 0
      };
      
      // 使用Address模型添加地址
      const addressId = await Address.create(addressData);
      
      // 获取刚创建的地址
      const newAddress = await Address.getAddressById(addressId);
      
      // 格式化地址数据
      const formattedAddress = {
        id: newAddress.id,
        name: newAddress.recipient_name,
        phone: newAddress.phone,
        province: newAddress.province,
        city: newAddress.city,
        district: newAddress.district,
        detail: newAddress.detail_address,
        is_default: newAddress.is_default === 1,
        created_at: newAddress.created_at,
        updated_at: newAddress.updated_at
      };
      
      return success(res, formattedAddress, '添加地址成功', 201);
    } catch (err) {
      console.error('添加地址失败:', err);
      return error(res, '添加地址失败', 500);
    }
  }
      

  
  // 更新地址
  static async updateAddress(req, res) {
    try {
      // 从请求体或用户会话中获取用户ID
      // 优先从请求体获取userId，取消强制登录验证
      let userId = req.body.userId;
      
      // 如果请求体中没有userId，则尝试从用户会话中获取
      if (!userId && req.user && req.user.id) {
        userId = req.user.id;
      }
      
      // 如果仍然没有userId，返回错误
      if (!userId) {
        return error(res, '用户ID不能为空', 400);
      }
      
      // 确保userId是数字类型
      userId = parseInt(userId);
      if (isNaN(userId)) {
        return error(res, '用户ID格式不正确', 400);
      }
      
      const addressId = req.params.id;
      const { name, phone, province, city, district, detail, is_default } = req.body;
      
      // 验证必填字段
      if (!name || !phone || !province || !city || !district || !detail) {
        return error(res, '请填写完整的地址信息', 400);
      }
      
      // 准备更新数据
      const updateData = {
        recipient_name: name,
        phone,
        province,
        city,
        district,
        detail_address: detail,
        is_default: is_default ? 1 : 0
      };
      
      // 使用Address模型更新地址
      const updated = await Address.update(addressId, userId, updateData, is_default);
      
      if (!updated) {
        return error(res, '地址不存在', 404);
      }
      
      // 获取更新后的地址
      const address = await Address.getAddressById(addressId);
      
      // 格式化地址数据
      const formattedAddress = {
        id: address.id,
        name: address.recipient_name,
        phone: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        detail: address.detail_address,
        is_default: address.is_default === 1,
        created_at: address.created_at,
        updated_at: address.updated_at
      };
      
      return success(res, formattedAddress, '更新地址成功');
    } catch (err) {
      console.error('更新地址失败:', err);
      return error(res, '更新地址失败', 500);
    }
  }
  
  // 删除地址
  static async deleteAddress(req, res) {
    try {
      // 从请求体或用户会话中获取用户ID
      // 优先从请求体获取userId，取消强制登录验证
      let userId = req.body.userId;
      
      // 如果请求体中没有userId，则尝试从用户会话中获取
      if (!userId && req.user && req.user.id) {
        userId = req.user.id;
      }
      
      // 如果仍然没有userId，返回错误
      if (!userId) {
        return error(res, '用户ID不能为空', 400);
      }
      
      // 确保userId是数字类型
      userId = parseInt(userId);
      if (isNaN(userId)) {
        return error(res, '用户ID格式不正确', 400);
      }
      
      const addressId = req.params.id;
      
      // 使用Address模型删除地址
      const deleted = await Address.delete(addressId, userId);
      
      if (!deleted) {
        return error(res, '地址不存在', 404);
      }
      
      return success(res, null, '删除地址成功');
    } catch (err) {
      console.error('删除地址失败:', err);
      return error(res, '删除地址失败', 500);
    }
  }
  
  // 设置默认地址
  static async setDefaultAddress(req, res) {
    try {
      // 从请求体或用户会话中获取用户ID
      // 优先从请求体获取userId，取消强制登录验证
      let userId = req.body.userId;
      
      // 如果请求体中没有userId，则尝试从用户会话中获取
      if (!userId && req.user && req.user.id) {
        userId = req.user.id;
      }
      
      // 如果仍然没有userId，返回错误
      if (!userId) {
        return error(res, '用户ID不能为空', 400);
      }
      
      // 确保userId是数字类型
      userId = parseInt(userId);
      if (isNaN(userId)) {
        return error(res, '用户ID格式不正确', 400);
      }
      
      const addressId = req.params.id;
      
      // 使用Address模型设置默认地址
      const result = await Address.setDefault(addressId, userId);
      
      if (!result) {
        return error(res, '地址不存在', 404);
      }
      
      return success(res, null, '设置默认地址成功');
    } catch (err) {
      console.error('设置默认地址失败:', err);
      return error(res, '设置默认地址失败', 500);
    }
  }
}

module.exports = AddressController;