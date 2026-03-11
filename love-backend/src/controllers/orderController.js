const Order = require('../models/Order');
const Cart = require('../models/Cart');
const UserPoints = require('../models/UserPoints');
const PointsHistory = require('../models/PointsHistory');
const TaskVolunteer = require('../models/TaskVolunteer');
const Task = require('../models/Task');
const Volunteer = require('../models/Volunteer');
const Merchant = require('../models/Merchant');
const OrderVolunteer = require('../models/OrderVolunteer');
const TaskAcceptLimit = require('../models/TaskAcceptLimit');
const OrderPushService = require('../services/orderPushService');
const db = require('../config/database');
const { success, error, badRequest, notFound } = require('../utils/response');

class OrderController {
    /**
     * 创建订单
     */
    async createOrder(req, res) {
        try {
            const userId = req.user.id; // 从认证中间件获取用户ID
            const orderData = req.body;

            // 验证必需参数
            if (!orderData.total_amount || orderData.total_amount <= 0) {
                return badRequest(res, '订单金额必须大于0');
            }
            
            // 验证商家ID
            if (!orderData.merchant_id) {
                return badRequest(res, '商家ID不能为空');
            }

            const totalAmountNum = parseFloat(orderData.total_amount);
            if (isNaN(totalAmountNum)) {
                return badRequest(res, '订单金额格式不正确');
            }

            // 验证订单类型
            if (orderData.order_type && !['takeaway', 'dine_in'].includes(orderData.order_type)) {
                return badRequest(res, '订单类型必须是takeaway或dine_in');
            }

            // 如果是外送订单，验证配送信息
            if (orderData.order_type === 'takeaway' || (!orderData.order_type && orderData.delivery_address)) {
                if (!orderData.delivery_address || !orderData.recipient_name || !orderData.recipient_phone) {
                    return badRequest(res, '外送订单必须提供配送地址、收件人姓名和联系电话');
                }
                // 验证电话号码格式（简单验证）
                if (!/^1[3-9]\d{9}$/.test(orderData.recipient_phone)) {
                    return badRequest(res, '收件人电话号码格式不正确');
                }
            }

            // 验证配送费用格式
            if (orderData.delivery_fee) {
                const deliveryFeeNum = parseFloat(orderData.delivery_fee);
                if (isNaN(deliveryFeeNum) || deliveryFeeNum < 0) {
                    return badRequest(res, '配送费用必须是非负数');
                }
            }

            // 验证商品明细
            if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
                return badRequest(res, '订单必须包含商品明细');
            }

            // 验证每个商品明细
            // 支持两种字段名格式：productId/productName 或 product_id/product_name
            for (const item of orderData.items) {
                const productId = item.productId || item.product_id;
                const productName = item.productName || item.product_name;
                
                if (!productId || !productName || !item.price || !item.quantity) {
                    return badRequest(res, '商品明细信息不完整');
                }
                if (item.price <= 0 || item.quantity <= 0) {
                    return badRequest(res, '商品价格和数量必须大于0');
                }
                // subtotal字段是可选的，如果没有提供则自动计算
                if (!item.subtotal) {
                    item.subtotal = item.price * item.quantity;
                }
            }

            // 转换数据格式，确保字段名称与模型一致
            // 同时统一商品项的字段名格式（转换为 productId/productName）
            const formattedItems = orderData.items.map(item => ({
                productId: item.productId || item.product_id,
                productName: item.productName || item.product_name,
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 0,
                subtotal: item.subtotal || (Number(item.price) || 0) * (Number(item.quantity) || 0)
            }));
            
            const formattedOrderData = {
                totalAmount: totalAmountNum,
                items: formattedItems,
                orderType: orderData.order_type || 'takeaway',
                paymentMethod: orderData.payment_method || 'cash',
                remark: orderData.remark || null,
                utensils: orderData.utensils || 0,
                pickupNumber: orderData.pickup_number || null,
                deliveryAddress: orderData.delivery_address || null,
                recipientName: orderData.recipient_name || null,
                recipientPhone: orderData.recipient_phone || null,
                deliveryFee: orderData.delivery_fee ? parseFloat(orderData.delivery_fee) : 0.00
            };

            // 注意：这里调用的方法名需要与模型中的方法名一致
            // 确保 merchant_id 不为空
            const merchantId = String(orderData.merchant_id || '').trim();
            if (!merchantId) {
                return badRequest(res, '商家ID不能为空');
            }
            
            // 验证商家ID是否在数据库中存在
            const Merchant = require('../models/Merchant');
            const merchant = await Merchant.findByMerchantId(merchantId);
            if (!merchant) {
                console.error(`商家ID不存在: ${merchantId}`);
                return badRequest(res, `商家ID不存在: ${merchantId}`);
            }
            
            console.log(`验证商家ID成功: ${merchantId}, 商家名称: ${merchant.name}`);
            
            const result = await Order.create(formattedOrderData, userId, merchantId);
            
            // 如果支付方式是积分支付，扣除用户积分
            if (formattedOrderData.paymentMethod === 'points') {
                const connection = await db.getConnection();
                await connection.beginTransaction();
                
                try {
                    const userPoints = await UserPoints.findByUserId(userId, connection);
                    
                    if (!userPoints) {
                        throw new Error('用户积分记录不存在');
                    }
                    
                    if (userPoints.available_points < totalAmountNum) {
                        throw new Error('用户积分不足');
                    }
                    
                    const totalPointsBefore = userPoints.total_points;
                    const totalPointsAfter = totalPointsBefore - totalAmountNum;
                    const availablePointsBefore = userPoints.available_points;
                    const availablePointsAfter = availablePointsBefore - totalAmountNum;
                    
                    const usePointsResult = await UserPoints.usePoints(userId, totalAmountNum, connection);
                    
                    if (!usePointsResult.success) {
                        throw new Error('积分扣除失败');
                    }
                    
                    // 记录积分历史
                    await PointsHistory.create({
                        user_id: userId,
                        change_type: 'spend',
                        points_change: -totalAmountNum,
                        total_points_before: totalPointsBefore,
                        total_points_after: totalPointsAfter,
                        available_points_before: availablePointsBefore,
                        available_points_after: availablePointsAfter,
                        reason: 'order_payment',
                        description: `订单支付扣除积分: ${totalAmountNum}`,
                        related_id: result.data.orderId
                    }, connection);
                    
                    await connection.commit();
                    console.log('订单创建时积分扣除成功');
                } catch (pointsError) {
                    await connection.rollback();
                    console.error('订单创建时积分扣除失败:', pointsError);
                    // 如果积分扣除失败，返回错误
                    connection.release();
                    if (pointsError.message === '用户积分不足') {
                        return badRequest(res, '用户积分不足，无法完成支付');
                    } else if (pointsError.message === '用户积分记录不存在') {
                        return badRequest(res, '用户积分记录不存在，请先获取积分');
                    } else {
                        return error(res, '积分扣除失败: ' + pointsError.message);
                    }
                } finally {
                    connection.release();
                }
            }
            
            // 订单创建成功后，从购物车中删除该订单包含的商品
            try {
                if (result.data && result.data.items && result.data.items.length > 0) {
                    for (const item of result.data.items) {
                        const productId = item.productId || item.product_id;
                        if (productId) {
                            try {
                                await Cart.removeItem(userId, productId);
                                console.log(`已从购物车删除商品: ${productId}`);
                            } catch (cartError) {
                                // 如果购物车中没有该商品，忽略错误（可能已经被删除）
                                console.warn(`从购物车删除商品失败 (可能不存在): ${productId}`, cartError.message);
                            }
                        }
                    }
                }
            } catch (cartError) {
                // 购物车删除失败不影响订单创建成功
                console.error('从购物车删除商品时出错:', cartError);
            }
            
            // 订单创建成功后，尝试推送通知给老人（异步处理，不阻塞响应）
            if (result.data && result.data.orderId) {
                // 异步推送，不阻塞订单创建响应
                OrderPushService.pushOrderToElderly({
                    orderNo: result.data.orderNo,
                    orderType: formattedOrderData.orderType,
                    recipientPhone: formattedOrderData.recipientPhone,
                    recipientName: formattedOrderData.recipientName,
                    deliveryAddress: formattedOrderData.deliveryAddress,
                    totalAmount: formattedOrderData.totalAmount,
                    scheduledDeliveryTime: orderData.scheduled_delivery_time || null
                }, result.data.orderId, userId).catch(pushError => {
                    // 推送失败不影响订单创建成功
                    console.error('订单推送失败（不影响订单创建）:', pushError);
                });
            }
            
            return success(res, {
                orderId: result.data.orderId,
                orderNo: result.data.orderNo
            }, '订单创建成功');

        } catch (err) {
            console.error('创建订单失败:', err);
            return error(res, err.message || '创建订单失败');
        }
    }

    /**
     * 获取用户订单列表
     */
    async getUserOrders(req, res) {
        try {
            const userId = req.user.id;
            const { status, page = 1, limit = 10 } = req.query;

            console.log('控制器接收到的参数:', { userId, status, page, limit, query: req.query });

            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (isNaN(pageNum) || pageNum <= 0) {
                return badRequest(res, '页码格式不正确');
            }

            if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
                return badRequest(res, '每页数量格式不正确或超出限制');
            }

            // 确保status参数正确处理，空字符串转为null
            const statusFilter = (status && status.trim() !== '') ? status : null;

            console.log('传递给模型的参数:', { userId, statusFilter, pageNum, limitNum });

            const result = await Order.getUserOrders(userId, statusFilter, pageNum, limitNum);
            return success(res, result.data, '获取订单列表成功');

        } catch (err) {
            console.error('获取订单列表失败:', err);
            return error(res, err.message || '获取订单列表失败');
        }
    }

    /**
     * 获取订单详情
     */
    async getOrderDetail(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const orderId = parseInt(id);
            if (isNaN(orderId) || orderId <= 0) {
                return badRequest(res, '订单ID格式不正确');
            }

            const order = await Order.findById(orderId, null, userId);
            if (!order) {
                return notFound(res, '订单不存在或无权访问');
            }

            return success(res, order, '获取订单详情成功');

        } catch (err) {
            console.error('获取订单详情失败:', err);
            if (err.message === '订单不存在' || err.message.includes('无权访问')) {
                return notFound(res, '订单不存在或无权访问');
            }
            return error(res, err.message || '获取订单详情失败');
        }
    }

    /**
     * 更新订单状态
     */
    async updateOrderStatus(req, res) {
        try {
            let merchantId = req.headers['x-merchant-id'] || req.query.merchant_id || req.query.merchantId;
            const userId = req.user?.id;
            const roleId = req.user?.role_id;
            
            if (!merchantId && !userId) {
                return badRequest(res, '缺少必要的身份信息');
            }
            
            const { id } = req.params;
            const { status, remark = null } = req.body;

            const orderId = parseInt(id, 10);
            if (isNaN(orderId) || orderId <= 0) {
                return badRequest(res, '订单ID格式不正确');
            }

            if (!status) {
                return badRequest(res, '订单状态不能为空');
            }

            const validStatuses = [
                'pending',
                'cancelled',
                'refunded',
                'paid',
                'customer_accepted',
                'merchant_accepted',
                'waiting_volunteer',
                'volunteer_accepted',
                'arrived_restaurant',
                'shipped',
                'delivered',
                'completed'
            ];
            if (!validStatuses.includes(status)) {
                return badRequest(res, '订单状态值不正确');
            }

            let operatorRole = merchantId ? 'merchant' : 'user';
            let volunteerId = null;

            let order = null;
            if (merchantId) {
                order = await Order.findById(orderId, merchantId, null);
            } else {
                order = await Order.findById(orderId, null, userId);
            }
            
            if (!order) {
                if (roleId === 3 && userId) {
                    const volunteer = await Volunteer.findOne({ user_id: userId });
                    if (!volunteer || !volunteer.volunteer_id) {
                        return badRequest(res, '未找到志愿者信息，请先完成认证');
                    }
                    volunteerId = volunteer.volunteer_id;

                    const assignment = await OrderVolunteer.findByOrderId(orderId);
                    if (!assignment || assignment.volunteer_id !== volunteerId) {
                        return notFound(res, '订单不存在或无权访问');
                    }

                    order = await Order.findById(orderId, null, null);
                    operatorRole = 'volunteer';
                } else {
                return notFound(res, '订单不存在或无权访问');
                }
            } else if (operatorRole === 'merchant' || operatorRole === 'user') {
                if (roleId === 3 && !merchantId) {
                    const volunteer = await Volunteer.findOne({ user_id: userId });
                    if (volunteer) {
                        volunteerId = volunteer.volunteer_id;
                    }
                }
            }
            
            const currentStatus = order.status;
            
            const validTransitions = {
                pending: ['paid', 'cancelled'],
                paid: ['merchant_accepted', 'refunded'],
                merchant_accepted: ['waiting_volunteer'],
                waiting_volunteer: ['volunteer_accepted'],
                volunteer_accepted: ['arrived_restaurant'],
                arrived_restaurant: ['shipped'],
                shipped: ['delivered'],
                delivered: ['completed'],
                cancelled: [],
                refunded: [],
                completed: []
            };
            
            if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
                return badRequest(res, `订单状态无法从${currentStatus}转换为${status}`);
            }

            const volunteerFlowStatuses = ['volunteer_accepted', 'arrived_restaurant', 'shipped', 'delivered', 'completed'];

            if (volunteerFlowStatuses.includes(status)) {
                if (operatorRole !== 'volunteer') {
                    return badRequest(res, '只有承接该订单的志愿者可以更新该状态');
                }

                const connection = await db.getConnection();
                try {
                    await connection.beginTransaction();

                    const [orderRows] = await connection.execute(
                        'SELECT status FROM orders WHERE id = ? FOR UPDATE',
                        [orderId]
                    );
                    if (orderRows.length === 0) {
                        await connection.rollback();
                        return notFound(res, '订单不存在');
                    }

                    const lockedStatus = orderRows[0].status;
                    if (!validTransitions[lockedStatus] || !validTransitions[lockedStatus].includes(status)) {
                        await connection.rollback();
                        return badRequest(res, `订单状态无法从${lockedStatus}转换为${status}`);
                    }

                    const assignment = await OrderVolunteer.findByOrderId(orderId, { connection, forUpdate: true });
                    if (!assignment || assignment.volunteer_id !== volunteerId) {
                        await connection.rollback();
                        return badRequest(res, '当前订单已不再由您负责');
                    }

                    await connection.execute(
                        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
                        [status, orderId]
                    );

                    await connection.execute(
                        `INSERT INTO order_status_logs (order_id, operator_id, operator_role, from_status, to_status, remark)
                         VALUES (?, ?, 'volunteer', ?, ?, ?)`,
                        [orderId, userId, lockedStatus, status, remark]
                    );

                    const ovStatusMap = {
                        volunteer_accepted: 'accepted',
                        arrived_restaurant: 'accepted',
                        shipped: 'picked',
                        delivered: 'delivered',
                        completed: 'delivered'
                    };
                    const ovStatus = ovStatusMap[status] || 'accepted';

                    await OrderVolunteer.updateStatus(
                        orderId,
                        ovStatus,
                        { remark },
                        connection
                    );

                    await connection.commit();
                    return success(res, null, '订单状态更新成功');
                } catch (volErr) {
                    await connection.rollback();
                    console.error('志愿者状态更新失败:', volErr);
                    return error(res, volErr.message || '订单状态更新失败');
                } finally {
                    connection.release();
                }
            }

            if (operatorRole === 'volunteer') {
                return badRequest(res, '志愿者仅可操作配送流程状态');
            }

            // 处理退款：返还积分
            if (status === 'refunded' && (currentStatus === 'paid' || currentStatus === 'merchant_accepted' || currentStatus === 'customer_accepted')) {
                // 获取订单详情
                const orderDetail = await Order.getOrderById(orderId, userId || null);
                const orderAmount = orderDetail.data.total_amount;
                const paymentMethod = orderDetail.data.payment_method;
                
                // 只有积分支付的订单才需要返还积分
                if (paymentMethod === 'points' && userId) {
                    const connection = await db.getConnection();
                    await connection.beginTransaction();
                    
                    try {
                        const userPoints = await UserPoints.findByUserId(userId, connection);
                        
                        if (!userPoints) {
                            throw new Error('用户积分记录不存在');
                        }
                        
                        const totalPointsBefore = userPoints.total_points;
                        const totalPointsAfter = totalPointsBefore + orderAmount;
                        const availablePointsBefore = userPoints.available_points;
                        const availablePointsAfter = availablePointsBefore + orderAmount;
                        
                        const addPointsResult = await UserPoints.addPoints(userId, orderAmount, connection);
                        
                        if (!addPointsResult.success) {
                            throw new Error('积分返还失败');
                        }
                        
                        // 记录积分历史
                        await PointsHistory.create({
                            user_id: userId,
                            change_type: 'earn',
                            points_change: orderAmount,
                            total_points_before: totalPointsBefore,
                            total_points_after: totalPointsAfter,
                            available_points_before: availablePointsBefore,
                            available_points_after: availablePointsAfter,
                            reason: 'order_refund',
                            description: `订单退款返还积分: ${orderAmount}`,
                            related_id: orderId
                        }, connection);
                        
                        await connection.commit();
                        console.log('订单退款时积分返还成功');
                    } catch (pointsError) {
                        await connection.rollback();
                        console.error('订单退款时积分返还失败:', pointsError);
                        // 积分返还失败不影响订单状态更新，只记录错误
                        console.warn('积分返还失败，但订单状态已更新为退款');
                    } finally {
                        connection.release();
                    }
                }
            }

            if (currentStatus === 'pending' && status === 'paid') {
                if (!userId) {
                    return badRequest(res, '只有下单用户可以完成支付操作');
                }
                const connection = await db.getConnection();
                await connection.beginTransaction();
                
                try {
                    const orderDetail = await Order.getOrderById(orderId, userId);
                    const orderAmount = orderDetail.data.total_amount;
                    
                    const userPoints = await UserPoints.findByUserId(userId, connection);
                    
                    if (!userPoints) {
                        throw new Error('用户积分记录不存在');
                    }
                    
                    if (userPoints.available_points < orderAmount) {
                        throw new Error('用户积分不足');
                    }
                    
                    const totalPointsBefore = userPoints.total_points;
                    const totalPointsAfter = totalPointsBefore - orderAmount;
                    const availablePointsBefore = userPoints.available_points;
                    const availablePointsAfter = availablePointsBefore - orderAmount;
                    
                    const usePointsResult = await UserPoints.usePoints(userId, orderAmount, connection);
                    
                    if (!usePointsResult.success) {
                        throw new Error('积分扣除失败');
                    }
                    
                    await PointsHistory.create({
                        user_id: userId,
                        change_type: 'spend',
                        points_change: -orderAmount,
                        total_points_before: totalPointsBefore,
                        total_points_after: totalPointsAfter,
                        available_points_before: availablePointsBefore,
                        available_points_after: availablePointsAfter,
                        reason: 'order_payment',
                        description: `订单支付扣除积分: ${orderAmount}`,
                        related_id: orderId
                    }, connection);
                    
                    const updateResult = await Order.updateStatus(orderId, status, merchantId, remark, userId, 'user');
                    
                    await connection.commit();
                    return success(res, null, updateResult.message);
                } catch (transactionError) {
                    await connection.rollback();
                    console.error('支付处理事务失败:', transactionError);
                    
                    if (transactionError.message === '用户积分不足') {
                        return badRequest(res, '用户积分不足，无法完成支付');
                    } else if (transactionError.message === '用户积分记录不存在') {
                        return badRequest(res, '用户积分记录不存在，请先获取积分');
                    } else {
                        return error(res, '支付处理失败: ' + transactionError.message);
                    }
                } finally {
                    connection.release();
                }
            } else {
                const result = await Order.updateStatus(orderId, status, merchantId, remark, userId, operatorRole);
            return success(res, null, result.message);
            }

        } catch (err) {
            console.error('更新订单状态失败:', err);
            if (err.message === '订单不存在或无权限操作') {
                return notFound(res, '订单不存在或无权限操作');
            }
            return error(res, err.message || '更新订单状态失败');
        }
    }

    /**
     * 获取订单轨迹（订单详情 + 日志 + 当前用户是否志愿者）
     */
    async getOrderTracking(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const orderId = parseInt(id, 10);
            if (isNaN(orderId) || orderId <= 0) {
                return badRequest(res, '订单ID格式不正确');
            }

            // 先检查订单是否存在（不限制用户，因为志愿者也需要查看）
            let order = await Order.findById(orderId, null, null);
            if (!order) {
                return notFound(res, '订单不存在');
            }

            // 权限检查：必须是订单创建者 OR 该订单的志愿者 OR 该订单的商家
            const isOrderOwner = order.user_id === userId;
            let canViewAsVolunteer = false;
            let canViewAsMerchant = false;
            let isCurrentVolunteer = false;
            
            console.log(`订单 ${orderId} 权限检查开始：用户ID=${userId}, 订单merchant_id=${order.merchant_id}, 用户role_id=${req.user?.role_id}`);
            
            // 查询订单是否已经绑定志愿者
            let assignment = null;
            try {
                assignment = await OrderVolunteer.findByOrderId(orderId);
            } catch (assignErr) {
                console.error('获取订单志愿者分配信息失败:', assignErr);
            }

            // 检查商家权限（role_id === 2）
            if (req.user && req.user.role_id === 2 && order.merchant_id) {
                console.log(`用户 ${userId} 是商家（role_id=2），开始检查商家权限...`);
                try {
                    const merchant = await Merchant.findByUserId(userId);
                    console.log(`用户 ${userId} 的商家信息:`, merchant ? `merchant_id=${merchant.id} (类型: ${typeof merchant.id})` : '未找到商家信息');
                    console.log(`订单 merchant_id: ${order.merchant_id} (类型: ${typeof order.merchant_id})`);
                    
                    // 统一转换为字符串进行比较，避免类型不匹配
                    const merchantIdStr = merchant ? String(merchant.id) : null;
                    const orderMerchantIdStr = String(order.merchant_id);
                    
                    if (merchant && merchantIdStr === orderMerchantIdStr) {
                        canViewAsMerchant = true;
                        console.log(`✅ 商家权限验证通过：用户merchant_id=${merchantIdStr}, 订单merchant_id=${orderMerchantIdStr}`);
                    } else {
                        console.log(`❌ 商家权限验证失败：用户merchant_id=${merchantIdStr || 'null'}, 订单merchant_id=${orderMerchantIdStr}`);
                    }
                } catch (merchantErr) {
                    console.error('判断商家关系失败:', merchantErr);
                }
            } else {
                console.log(`跳过商家权限检查：req.user存在=${!!req.user}, role_id=${req.user?.role_id}, 订单merchant_id=${order.merchant_id}`);
            }

            // 获取志愿者信息（如果用户是志愿者）
            let volunteerId = null;
            try {
                const volunteer = await Volunteer.findOne({ user_id: userId });
                if (volunteer && volunteer.volunteer_id) {
                    volunteerId = volunteer.volunteer_id;
                    if (assignment && assignment.volunteer_id === volunteerId) {
                        isCurrentVolunteer = true;
                        canViewAsVolunteer = true;
                    } else {
                        // 尚未接取该订单，检查是否已认领任务
                        canViewAsVolunteer = await TaskVolunteer.isVolunteerOfOrder(userId, orderId);
                    }
                }
            } catch (volunteerErr) {
                console.error('判断志愿者关系失败:', volunteerErr);
                // 如果查询失败，记录错误但不阻止访问（可能是数据库问题）
            }

            // 如果既不是订单创建者，也没有志愿者权限，也没有商家权限，返回无权访问
            if (!isOrderOwner && !canViewAsVolunteer && !canViewAsMerchant) {
                console.log(`用户 ${userId} 尝试访问订单 ${orderId}，权限检查失败：isOrderOwner=${isOrderOwner}, canViewAsVolunteer=${canViewAsVolunteer}, canViewAsMerchant=${canViewAsMerchant}`);
                console.log(`订单详情：order.user_id=${order.user_id}, order.merchant_id=${order.merchant_id}`);
                return notFound(res, '无权访问此订单。请确保您已接取该订单所属的任务。');
            }
            
            console.log(`✅ 用户 ${userId} 权限验证通过，允许访问订单 ${orderId}`);

            // 补充商家信息（餐厅名称、地址、经纬度）
            let restaurantInfo = {
                restaurant_name: '',
                restaurant_address: '',
                restaurant_latitude: null,
                restaurant_longitude: null
            };

            if (order.merchant_id) {
                try {
                    const [merchantRows] = await db.execute(
                        `SELECT name, address, latitude, longitude 
                         FROM merchants 
                         WHERE id = ?`,
                        [order.merchant_id]
                    );
                    if (merchantRows.length > 0) {
                        restaurantInfo = {
                            restaurant_name: merchantRows[0].name || '',
                            restaurant_address: merchantRows[0].address || '',
                            restaurant_latitude: merchantRows[0].latitude || null,
                            restaurant_longitude: merchantRows[0].longitude || null
                        };
                    }
                } catch (merchantErr) {
                    console.error('获取商家信息失败:', merchantErr);
                }
            }

            // 补充收货人信息（如果订单中没有，尝试从用户地址表获取默认地址）
            let recipientInfo = {
                recipient_name: order.recipient_name || '',
                recipient_phone: order.recipient_phone || '',
                delivery_address: order.delivery_address || '',
                recipient_latitude: null,
                recipient_longitude: null
            };

            // 如果订单中没有收货人信息，尝试从用户地址表获取默认地址
            if ((!order.recipient_name || !order.recipient_phone || !order.delivery_address) && order.user_id) {
                try {
                    const [addressRows] = await db.execute(
                        `SELECT recipient_name, phone, 
                                CONCAT(province, city, district, detail_address) as full_address,
                                detail_address
                         FROM user_addresses 
                         WHERE user_id = ? AND is_default = 1
                         ORDER BY created_at DESC
                         LIMIT 1`,
                        [order.user_id]
                    );
                    if (addressRows.length > 0) {
                        const defaultAddress = addressRows[0];
                        recipientInfo = {
                            recipient_name: order.recipient_name || defaultAddress.recipient_name || order.user_nickname || '',
                            recipient_phone: order.recipient_phone || defaultAddress.phone || order.user_phone || '',
                            delivery_address: order.delivery_address || defaultAddress.full_address || defaultAddress.detail_address || '',
                            recipient_latitude: null,
                            recipient_longitude: null
                        };
                    }
                } catch (addressErr) {
                    console.error('获取用户默认地址失败:', addressErr);
                    // 如果获取地址失败，使用订单用户信息作为备用
                    if (!recipientInfo.recipient_name) {
                        recipientInfo.recipient_name = order.user_nickname || '';
                    }
                    if (!recipientInfo.recipient_phone) {
                        recipientInfo.recipient_phone = order.user_phone || '';
                    }
                }
            }

            // 合并订单信息、商家信息和收货人信息
            const orderWithMerchant = {
                ...order,
                ...restaurantInfo,
                ...recipientInfo
            };

            // 轨迹日志
            const logs = await Order.getStatusLogs(orderId);

            const hasVolunteer = !!assignment;

            return success(res, {
                order: orderWithMerchant,
                logs: logs || [],
                isCurrentVolunteer: !!isCurrentVolunteer,
                hasVolunteer: hasVolunteer
            }, '获取订单轨迹成功');
        } catch (err) {
            console.error('获取订单轨迹失败:', err);
            return error(res, err.message || '获取订单轨迹失败');
        }
    }

    /**
     * 取消订单
     */
    async cancelOrder(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const orderId = parseInt(id);
            if (isNaN(orderId) || orderId <= 0) {
                return badRequest(res, '订单ID格式不正确');
            }

            const result = await Order.cancelOrder(orderId, userId);
            return success(res, null, result.message);

        } catch (err) {
            console.error('取消订单失败:', err);
            if (err.message === '订单不存在、无权限操作或订单状态不允许取消') {
                return notFound(res, '订单不存在、无权限操作或订单状态不允许取消');
            }
            return error(res, err.message || '取消订单失败');
        }
    }

    /**
     * 删除订单
     */
    async deleteOrder(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const orderId = parseInt(id);
            if (isNaN(orderId) || orderId <= 0) {
                return badRequest(res, '订单ID格式不正确');
            }

            const result = await Order.deleteOrder(orderId, userId);
            return success(res, null, result.message);

        } catch (err) {
            console.error('删除订单失败:', err);
            if (err.message === '订单不存在、无权限操作或订单状态不允许删除') {
                return notFound(res, '订单不存在、无权限操作或订单状态不允许删除');
            }
            return error(res, err.message || '删除订单失败');
        }
    }

    /**
     * 志愿者接单（接取任务并更新订单状态）
     */
    async acceptOrder(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return badRequest(res, '用户未登录');
            }

            // 检查用户是否为志愿者
            if (req.user?.role_id !== 3) {
                return badRequest(res, '只有志愿者可以接单');
            }

            const { id } = req.params;
            const orderId = parseInt(id, 10);
            if (isNaN(orderId) || orderId <= 0) {
                return badRequest(res, '订单ID格式不正确');
            }

            // 获取志愿者ID
            const volunteer = await Volunteer.findOne({ user_id: userId });
            if (!volunteer || !volunteer.volunteer_id) {
                return badRequest(res, '未找到志愿者信息，请先完成认证');
            }
            const volunteerId = volunteer.volunteer_id;

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // 锁定订单
                const [orderRows] = await connection.execute(
                    `SELECT id, status, task_id, volunteer_id 
                     FROM orders 
                     WHERE id = ? 
                     FOR UPDATE`,
                    [orderId]
                );

                if (orderRows.length === 0) {
                    await connection.rollback();
                    return notFound(res, '订单不存在');
                }

                const order = orderRows[0];

                if (!['waiting_volunteer', 'volunteer_accepted'].includes(order.status)) {
                    await connection.rollback();
                    return badRequest(res, `订单当前状态为${order.status}，无法接单`);
                }

                // 确定任务ID
                let taskId = order.task_id;
                if (!taskId) {
                    taskId = await Task.getTaskIdByOrderId(orderId);
                }
                if (!taskId) {
                    await connection.rollback();
                    return badRequest(res, '订单未关联到任何任务');
                }

                // 检查任务状态
                const task = await Task.getTaskById(taskId);
                if (!task) {
                    await connection.rollback();
                    return notFound(res, '任务不存在');
                }
                if (task.status >= 3) {
                    await connection.rollback();
                    return badRequest(res, '任务已结束或不可接取');
                }

                // 锁定订单的志愿者绑定记录
                const assignment = await OrderVolunteer.findByOrderId(orderId, { connection, forUpdate: true });
                if (assignment && assignment.volunteer_id !== volunteerId) {
                    await connection.rollback();
                    return badRequest(res, '该订单已被其他志愿者接取');
                }

                // 确保志愿者已认领任务（锁定接单名额）
                const [relationRows] = await connection.execute(
                    `SELECT relation_id 
                     FROM task_volunteer 
                     WHERE task_id = ? AND volunteer_id = ? 
                     LIMIT 1`,
                    [taskId, volunteerId]
                );

                if (relationRows.length === 0) {
                    const limit = await TaskAcceptLimit.getByTaskId(taskId, { connection, forUpdate: true });
                    if (!limit) {
                        await connection.rollback();
                        return error(res, '任务接单限制未初始化');
                    }
                    if (limit.current_accept_num >= limit.require_num) {
                        await connection.rollback();
                        return badRequest(res, '该任务的志愿者名额已满');
                    }

                    await TaskVolunteer.claimTask(taskId, volunteerId, connection);
                    await TaskAcceptLimit.increment(taskId, connection);
                }

                // 若尚未绑定志愿者，则写入绑定关系
                if (!assignment) {
                    try {
                        await OrderVolunteer.assign(orderId, volunteerId, taskId, connection);
                    } catch (assignErr) {
                        await connection.rollback();
                        if (assignErr.code === 'ORDER_ALREADY_ASSIGNED') {
                            return badRequest(res, '该订单已被其他志愿者接取');
                        }
                        throw assignErr;
                    }
                }

                const newStatus = 'volunteer_accepted';
                const oldStatus = order.status;

                if (oldStatus !== newStatus || order.volunteer_id !== volunteerId) {
                    await connection.execute(
                        `UPDATE orders 
                         SET status = ?, volunteer_id = ?, task_id = ?, updated_at = NOW()
                         WHERE id = ?`,
                        [newStatus, volunteerId, taskId, orderId]
                    );

                    await connection.execute(
                        `INSERT INTO order_status_logs (order_id, operator_id, operator_role, from_status, to_status, remark)
                         VALUES (?, ?, 'volunteer', ?, ?, ?)`,
                        [orderId, userId, oldStatus, newStatus, '志愿者接单']
                    );
                }

                await connection.commit();
                return success(res, null, '接单成功');
            } catch (innerErr) {
                await connection.rollback();
                throw innerErr;
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error('志愿者接单失败:', err);
            return error(res, err.message || '接单失败');
        }
    }

    /**
     * 获取订单统计信息
     */
    async getOrderStats(req, res) {
        try {
            console.log('开始处理订单统计请求');
            const userId = req.user.id;
            console.log('用户ID:', userId);

            // 获取所有订单
            console.log('调用Order.getUserOrders获取订单列表');
            const allOrders = await Order.getUserOrders(userId, null, 1, 1000);
            console.log('订单查询结果:', JSON.stringify(allOrders));
            
            const orders = allOrders.data.orders || [];
            console.log('订单数量:', orders.length);
            
            // 打印所有订单的状态，用于调试
            if (orders.length > 0) {
                console.log('所有订单状态列表:');
                orders.forEach((order, index) => {
                    console.log(`订单${index + 1}: ID=${order.id}, 状态=${order.status}, 订单号=${order.order_no}`);
                });
            } else {
                console.log('没有找到任何订单');
            }

            // 待配送状态列表
            const pendingStatuses = ['merchant_accepted', 'waiting_volunteer', 'volunteer_accepted', 'arrived_restaurant', 'shipped', 'delivered'];
            // 已完成状态
            const completedStatuses = ['completed'];
            // 已取消状态列表
            const cancelledStatuses = ['cancelled', 'refunded'];

            // 统计各状态订单数量
            const pendingOrders = orders.filter(order => {
                const isPending = pendingStatuses.includes(order.status);
                if (isPending) {
                    console.log(`找到待配送订单: ID=${order.id}, 状态=${order.status}`);
                }
                return isPending;
            });
            
            const completedOrders = orders.filter(order => {
                const isCompleted = completedStatuses.includes(order.status);
                if (isCompleted) {
                    console.log(`找到已完成订单: ID=${order.id}, 状态=${order.status}`);
                }
                return isCompleted;
            });
            
            const cancelledOrders = orders.filter(order => {
                const isCancelled = cancelledStatuses.includes(order.status);
                if (isCancelled) {
                    console.log(`找到已取消订单: ID=${order.id}, 状态=${order.status}`);
                }
                return isCancelled;
            });

            const stats = {
                total: orders.length,
                pending: pendingOrders.length,
                completed: completedOrders.length,
                cancelled: cancelledOrders.length
            };
            
            console.log('生成的订单统计数据:', JSON.stringify(stats));
            console.log('待配送订单数量:', pendingOrders.length);
            console.log('已完成订单数量:', completedOrders.length);
            console.log('已取消订单数量:', cancelledOrders.length);

            return success(res, stats, '获取订单统计成功');

        } catch (err) {
            console.error('获取订单统计失败:', err);
            return error(res, err.message || '获取订单统计失败');
        }
    }
}

module.exports = new OrderController();