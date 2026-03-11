// 地址相关路由
const express = require('express');
const router = express.Router();
const AddressController = require('../controllers/addressController');

// 获取用户地址列表
router.get('/', AddressController.getUserAddresses);

// 获取单个地址详情
router.get('/:id', AddressController.getAddressById);

// 添加新地址
router.post('/', AddressController.addAddress);

// 更新地址
router.put('/:id', AddressController.updateAddress);

// 删除地址
router.delete('/:id', AddressController.deleteAddress);

// 设置默认地址
router.put('/:id/default', AddressController.setDefaultAddress);

module.exports = router;