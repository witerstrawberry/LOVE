// src/controllers/merchantController.js
const Merchant = require('../models/Merchant');

/**
 * 获取商家信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getMerchantInfo = async (req, res) => {
    const debugInfo = [];
    
    try {
        const userId = req.user.id; // 假设已通过中间件验证并设置了user对象
        debugInfo.push(`用户ID: ${userId}`);
        
        const merchant = await Merchant.findByUserId(userId);
        debugInfo.push(`基本商家信息: ${JSON.stringify(merchant)}`);
        
        if (!merchant) {
            debugInfo.push('未找到商家信息');
            // 设置禁止缓存的响应头
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            return res.status(404).json({
                success: false,
                message: '未找到商家信息',
                debug: debugInfo
            });
        }
        
        // 获取商家详细信息（包含credit_code等字段）
        debugInfo.push('开始获取商家详细信息...');
        const merchantInfo = await Merchant.getMerchantInfoDetail(userId);
        debugInfo.push(`商家详细信息: ${JSON.stringify(merchantInfo)}`);
        
        // 合并基本信息和详细信息
        const merchantData = {
            ...merchant,
            ...merchantInfo
        };
        debugInfo.push(`合并后的完整数据: ${JSON.stringify(merchantData)}`);
        
        // 设置禁止缓存的响应头，确保返回最新数据
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString(),
            'ETag': `"merchant-${userId}-${Date.now()}"`
        });
        
        debugInfo.push('=== 控制器处理完成 ===');
        
        // 临时返回调试信息用于问题排查
        res.status(200).json({
            success: true,
            data: merchantData,
            debug: debugInfo,
            message: '调试模式：包含详细调试信息'
        });
    } catch (error) {
        debugInfo.push(`错误: ${error.message}`);
        debugInfo.push(`错误堆栈: ${error.stack}`);
        
        res.status(500).json({
            success: false,
            message: '服务器错误',
            debug: debugInfo
        });
    }
};

/**
 * 检查商家信息是否完善
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.checkInfoStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const isComplete = await Merchant.isInfoComplete(userId);
        
        res.status(200).json({
            success: true,
            data: {
                isComplete,
                message: isComplete ? '商家信息已完善' : '请完善商家信息'
            }
        });
    } catch (error) {
        console.error('检查商家信息状态失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
};

/**
 * 保存或更新商家信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.saveMerchantInfo = async (req, res) => {
    const debugInfo = [];
    try {
        const userId = req.user.id;
        const merchantData = req.body;
        
        debugInfo.push(`收到保存请求，数据: ${JSON.stringify(merchantData)}`);
        
        // 转换字段名格式：从 camelCase 转换为 snake_case 以匹配后端预期
        if (merchantData.creditCode !== undefined) merchantData.credit_code = merchantData.creditCode;
        if (merchantData.businessLicenseImage !== undefined) merchantData.business_license_image = merchantData.businessLicenseImage;
        if (merchantData.restaurantImage !== undefined) merchantData.restaurant_scene_image = merchantData.restaurantImage;
        
        debugInfo.push(`字段映射后的数据: ${JSON.stringify(merchantData)}`);
        
        // 验证必填字段
        const requiredFields = ['name', 'phone', 'address', 'business_hours', 'category'];
        const missingFields = requiredFields.filter(field => 
            !merchantData[field] || merchantData[field].toString().trim() === ''
        );
        
        if (missingFields.length > 0) {
            debugInfo.push(`缺少必填字段: ${missingFields.join(', ')}`);
            return res.status(400).json({
                success: false,
                message: `请填写必填字段: ${missingFields.join(', ')}`,
                debug: debugInfo
            });
        }
        
        debugInfo.push('字段验证通过，开始保存商家信息...');
        
        // 转换字段名格式以匹配merchants表
        const formattedData = {
            name: merchantData.name,
            phone: merchantData.phone,
            address: merchantData.address,
            business_hours: merchantData.business_hours,
            category: merchantData.category,
            description: merchantData.description,
            contact_person: merchantData.contact_person,
            min_order_amount: parseFloat(merchantData.min_order_amount) || 0,
            delivery_fee: parseFloat(merchantData.delivery_fee) || 0,
            delivery_scope: merchantData.delivery_scope
        };
        
        // 可选字段
        if (merchantData.latitude) formattedData.latitude = parseFloat(merchantData.latitude);
        if (merchantData.longitude) formattedData.longitude = parseFloat(merchantData.longitude);
        if (merchantData.logo) formattedData.logo = merchantData.logo;
        if (merchantData.license_url) formattedData.license_url = merchantData.license_url;
        
        debugInfo.push(`格式化后的merchants表数据: ${JSON.stringify(formattedData)}`);
        
        // 保存到merchants表
        const result = await Merchant.createOrUpdate(userId, formattedData);
        
        if (result.success) {
            debugInfo.push('merchants表保存成功');
            
            // 保存商家详细信息到merchant_info表
            debugInfo.push('开始保存商家详细信息到merchant_info表...');
            
            // 准备merchant_info表数据
            const merchantInfoData = {
                user_id: userId,
                merchant_name: merchantData.name,
                credit_code: merchantData.credit_code || '',
                legal_person: merchantData.legal_person || merchantData.contact_person || '',
                legal_phone: merchantData.legal_phone || merchantData.phone || '',
                register_address: merchantData.register_address || merchantData.address || '',
                business_address: merchantData.business_address || merchantData.address || '',
                contact_phone: merchantData.contact_phone || merchantData.phone || '',
                email: merchantData.email || '',
                website: merchantData.website || '',
                industry_type: merchantData.industry_type || merchantData.category || '',
                sub_industry: merchantData.sub_industry || '',
                establish_date: merchantData.establish_date || null, // 修复：日期字段不能是空字符串
                operate_period: merchantData.operate_period || merchantData.business_hours || '',
                business_license_image: merchantData.businessLicenseImage || merchantData.business_license_image || merchantData.businessLicense || '',
                restaurant_scene_image: merchantData.restaurantImage || merchantData.restaurant_image || merchantData.restaurantSceneImage || '',
                status: merchantData.status || 1
            };
            
            debugInfo.push(`准备保存到merchant_info表的数据: ${JSON.stringify(merchantInfoData)}`);
            
            // 调用saveMerchantInfoDetail方法保存详细信息
            const infoResult = await Merchant.saveMerchantInfoDetail(userId, merchantInfoData);
            
            if (infoResult.success) {
                debugInfo.push('merchant_info表保存成功');
            } else {
                debugInfo.push(`merchant_info表保存失败: ${infoResult.message}`);
            }
            
            // 重新获取最新的完整商家信息（包含merchant_info表数据）
            debugInfo.push('重新获取最新商家信息...');
            const updatedMerchant = await Merchant.findByUserId(userId);
            const merchantInfo = await Merchant.getMerchantInfoDetail(userId);
            
            const mergedData = {
                ...updatedMerchant,
                ...merchantInfo
            };
            
            debugInfo.push(`合并后的完整数据: ${JSON.stringify(mergedData)}`);
            
            // 设置禁止缓存的响应头
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Last-Modified': new Date().toUTCString(),
                'ETag': `"merchant-${userId}-${Date.now()}"`
            });
            
            debugInfo.push('=== 保存完成 ===');
            
            res.status(200).json({
                success: true,
                message: '商家信息保存成功',
                data: {
                    merchantId: result.merchantId,
                    merchant: mergedData // 返回合并的完整商家信息
                },
                debug: debugInfo
            });
        } else {
            debugInfo.push(`merchants表保存失败: ${result.message}`);
            res.status(400).json({
                success: false,
                message: result.message,
                debug: debugInfo
            });
        }
    } catch (error) {
        debugInfo.push(`保存过程中发生错误: ${error.message}`);
        debugInfo.push(`错误堆栈: ${error.stack}`);
        
        console.error('保存商家信息失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误',
            debug: debugInfo
        });
    }
};

/**
 * 获取商家信息完善状态（公开接口，不需要登录）
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.publicCheckInfoStatus = async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '缺少用户ID参数'
            });
        }
        
        const isComplete = await Merchant.isInfoComplete(userId);
        
        res.status(200).json({
            success: true,
            data: {
                isComplete,
                message: isComplete ? '商家信息已完善' : '请完善商家信息'
            }
        });
    } catch (error) {
        console.error('公开检查商家信息状态失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
};

/**
 * 公开获取商家基础信息（无需登录）
 * @param {Object} req 
 * @param {Object} res 
 */
exports.getPublicMerchantInfo = async (req, res) => {
    const debugInfo = [];
    try {
        const { merchantId, userId } = req.query;
        debugInfo.push(`收到公开获取商家信息请求, merchantId: ${merchantId || '未提供'}, userId: ${userId || '未提供'}`);

        let merchant = null;
        let resolvedUserId = userId;

        if (merchantId) {
            merchant = await Merchant.findByMerchantId(merchantId);
            debugInfo.push(`根据merchantId查询结果: ${merchant ? '找到记录' : '未找到记录'}`);
            if (merchant) {
                resolvedUserId = merchant.user_id;
            }
        }

        if (!merchant && userId) {
            merchant = await Merchant.findByUserId(userId);
            debugInfo.push(`根据userId查询结果: ${merchant ? '找到记录' : '未找到记录'}`);
        }

        if (!merchant) {
            merchant = await Merchant.findDefaultMerchant();
            debugInfo.push(`使用默认商家信息: ${merchant ? '找到记录' : '未找到记录'}`);
            if (merchant) {
                resolvedUserId = merchant.user_id;
            }
        }

        if (!merchant) {
            debugInfo.push('未找到任何商家信息');
            return res.status(404).json({
                success: false,
                message: '未找到商家信息',
                debug: debugInfo
            });
        }

        let merchantInfo = {};
        if (resolvedUserId) {
            debugInfo.push(`开始获取用户ID为${resolvedUserId}的详细信息`);
            merchantInfo = await Merchant.getMerchantInfoDetail(resolvedUserId);
        }

        const merchantData = {
            ...merchant,
            ...merchantInfo
        };

        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString(),
            'ETag': `"public-merchant-${merchant.id}-${Date.now()}"`
        });

        return res.status(200).json({
            success: true,
            data: merchantData,
            debug: debugInfo
        });
    } catch (error) {
        debugInfo.push(`公开获取商家信息失败: ${error.message}`);
        console.error('公开获取商家信息失败:', error);
        return res.status(500).json({
            success: false,
            message: error.message || '服务器错误',
            debug: debugInfo
        });
    }
};

/**
 * 更新商家营业状态
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.updateBusinessStatus = async (req, res) => {
    const debugInfo = [];
    try {
        const userId = req.user.id;
        const { is_open } = req.body; // 1=营业, 0=打烊
        
        debugInfo.push(`收到营业状态更新请求，用户ID: ${userId}, 状态: ${is_open ? '营业' : '打烊'}`);
        
        // 验证输入参数
        if (typeof is_open !== 'number' || ![0, 1].includes(is_open)) {
            debugInfo.push(`无效的状态值: ${is_open}`);
            return res.status(400).json({
                success: false,
                message: '营业状态值无效，必须为0或1',
                debug: debugInfo
            });
        }
        
        // 更新merchants表中的is_open字段
        const result = await Merchant.updateBusinessStatus(userId, is_open);
        
        if (result.success) {
            debugInfo.push('营业状态更新成功');
            
            // 设置禁止缓存的响应头，确保返回最新数据
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Last-Modified': new Date().toUTCString(),
                'ETag': `"business-status-${userId}-${Date.now()}"`
            });
            
            debugInfo.push('=== 营业状态更新完成 ===');
            
            res.status(200).json({
                success: true,
                message: is_open ? '已更新为营业状态' : '已更新为打烊状态',
                data: {
                    is_open: is_open,
                    status_text: is_open ? '营业中' : '已打烊'
                },
                debug: debugInfo
            });
        } else {
            debugInfo.push(`更新失败: ${result.message}`);
            res.status(400).json({
                success: false,
                message: result.message || '更新营业状态失败',
                debug: debugInfo
            });
        }
    } catch (error) {
        debugInfo.push(`更新过程中发生错误: ${error.message}`);
        debugInfo.push(`错误堆栈: ${error.stack}`);
        
        console.error('更新营业状态失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误',
            debug: debugInfo
        });
    }
};

/**
 * 获取商家营业状态
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getBusinessStatus = async (req, res) => {
    const debugInfo = [];
    try {
        const userId = req.user.id;
        
        debugInfo.push(`收到获取营业状态请求，用户ID: ${userId}`);
        
        // 获取商家信息
        const merchant = await Merchant.findByUserId(userId);
        
        if (!merchant) {
            debugInfo.push('未找到商家记录');
            return res.status(404).json({
                success: false,
                message: '未找到商家信息',
                debug: debugInfo
            });
        }
        
        // 获取营业状态，默认值为false（打烊）
        const isOpen = merchant.is_open === 1 || merchant.is_open === true;
        
        debugInfo.push(`获取到营业状态: ${isOpen ? '营业中' : '已打烊'}`);
        debugInfo.push('=== 获取营业状态完成 ===');
        
        // 设置禁止缓存的响应头，确保返回最新数据
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': new Date().toUTCString(),
            'ETag': `"business-status-${userId}-${Date.now()}"`
        });
        
        res.status(200).json({
            success: true,
            message: '获取营业状态成功',
            data: {
                is_open: isOpen ? 1 : 0,
                is_open_boolean: isOpen,
                status_text: isOpen ? '营业中' : '已打烊'
            },
            debug: debugInfo
        });
    } catch (error) {
        debugInfo.push(`获取过程中发生错误: ${error.message}`);
        debugInfo.push(`错误堆栈: ${error.stack}`);
        
        console.error('获取营业状态失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误',
            debug: debugInfo
        });
    }
};

/**
 * 获取商家统计数据（今日订单和营收）
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getMerchantStats = async (req, res) => {
    const debugInfo = [];
    try {
        const userId = req.user.id;
        
        debugInfo.push(`收到获取商家统计请求，用户ID: ${userId}`);

        // 根据用户ID获取商家信息，拿到真正的商家ID
        const merchant = await Merchant.findByUserId(userId);
        if (!merchant || !merchant.id) {
            debugInfo.push('未找到商家信息或缺少商家ID');
            return res.status(404).json({
                success: false,
                message: '未找到商家信息，请先完善商家资料',
                debug: debugInfo
            });
        }
        const merchantId = merchant.id;
        debugInfo.push(`匹配到商家ID: ${merchantId}`);
        
        // 导入Order模型
        const Order = require('../models/Order');
        
        // 调用Order模型的getMerchantStats方法获取统计数据
        const statsResult = await Order.getMerchantStats(merchantId);
        
        if (statsResult.success) {
            debugInfo.push('获取统计数据成功:', statsResult.data);
            debugInfo.push('=== 获取商家统计完成 ===');
            
            res.status(200).json({
                success: true,
                message: '获取商家统计数据成功',
                data: statsResult.data
            });
        } else {
            debugInfo.push('获取统计数据失败');
            res.status(400).json({
                success: false,
                message: '获取商家统计数据失败'
            });
        }
        
    } catch (error) {
        debugInfo.push(`获取统计过程中发生错误: ${error.message}`);
        debugInfo.push(`错误堆栈: ${error.stack}`);
        
        console.error('获取商家统计失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};

/**
 * 获取商家列表（公开接口，无需登录）
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getMerchantList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const category = req.query.category;

        const result = await Merchant.findAll({
            page,
            limit,
            category
        });

        res.status(200).json({
            success: true,
            data: result.merchants,
            pagination: result.pagination,
            message: '获取商家列表成功'
        });
    } catch (error) {
        console.error('获取商家列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取商家列表失败',
            error: error.message
        });
    }
};