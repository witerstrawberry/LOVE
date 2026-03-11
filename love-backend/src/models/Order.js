// 导入数据库配置
const db = require('../config/database');

class Order {
    /**
     * 创建订单
     * @param {Object} orderData 订单数据
     * @param {number} userId 用户ID
     * @param {string} merchantId 商家ID
     * @returns {Object} 创建结果
     */
    static async create(orderData, userId, merchantId) {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 验证必要字段
            if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
                throw new Error('订单商品不能为空');
            }

            if (!orderData.totalAmount || orderData.totalAmount <= 0) {
                throw new Error('订单金额必须大于0');
            }

            // 生成订单号
            const orderNo = this.generateOrderNo();

            // 确定订单类型和取餐码
            const orderType = orderData.orderType || 'takeaway';
            let pickupNumber = orderData.pickupNumber || null;
            
            // 如果是在店就餐订单且没有提供取餐码，则自动生成取餐码
            if (orderType === 'dine_in' && !pickupNumber) {
                pickupNumber = await this.generatePickupNumber(merchantId);
                console.log('为在店就餐订单自动生成取餐码:', pickupNumber);
            }
            
            // 创建订单主记录
            // 确保所有参数都不是 undefined，使用 null 代替
            // 订单状态设置为 'paid'（已支付），因为用户点击支付按钮后跳转到支付成功页面
            // 处理配送时间：如果前端传递的是"立即配送"或空值，则设置为 null
            let scheduledDeliveryTime = null;
            if (orderData.scheduledDeliveryTime && orderData.scheduledDeliveryTime !== '立即配送' && orderData.scheduledDeliveryTime.trim() !== '') {
                scheduledDeliveryTime = orderData.scheduledDeliveryTime;
            }
            
            // 检查 scheduled_delivery_time 字段是否存在，如果不存在则从 INSERT 语句中移除
            // 先尝试查询表结构
            let includeScheduledTime = true;
            try {
                const [columns] = await connection.execute(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = DATABASE() 
                     AND TABLE_NAME = 'orders' 
                     AND COLUMN_NAME = 'scheduled_delivery_time'`
                );
                if (columns.length === 0) {
                    includeScheduledTime = false;
                    console.warn('scheduled_delivery_time 字段不存在，将从 INSERT 语句中移除');
                }
            } catch (checkError) {
                // 如果检查失败，假设字段存在，继续执行
                console.warn('检查 scheduled_delivery_time 字段时出错，假设字段存在:', checkError.message);
            }
            
            // 根据字段是否存在构建不同的 SQL 语句
            let insertSql, insertParams;
            if (includeScheduledTime) {
                insertSql = `INSERT INTO orders (order_no, user_id, merchant_id, total_amount, order_type, status, payment_method, payment_time, remark, utensils, pickup_number, delivery_address, recipient_name, recipient_phone, delivery_fee, scheduled_delivery_time)
                             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`;
                insertParams = [
                    orderNo,
                    userId,
                    merchantId,
                    orderData.totalAmount,
                    orderType,
                    'paid',
                    orderData.paymentMethod || 'cash',
                    orderData.remark || null,
                    orderData.utensils || 0,
                    pickupNumber || null,
                    orderData.deliveryAddress || null,
                    orderData.recipientName || null,
                    orderData.recipientPhone || null,
                    orderData.deliveryFee || 0.00,
                    scheduledDeliveryTime
                ];
            } else {
                insertSql = `INSERT INTO orders (order_no, user_id, merchant_id, total_amount, order_type, status, payment_method, payment_time, remark, utensils, pickup_number, delivery_address, recipient_name, recipient_phone, delivery_fee)
                             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`;
                insertParams = [
                    orderNo,
                    userId,
                    merchantId,
                    orderData.totalAmount,
                    orderType,
                    'paid',
                    orderData.paymentMethod || 'cash',
                    orderData.remark || null,
                    orderData.utensils || 0,
                    pickupNumber || null,
                    orderData.deliveryAddress || null,
                    orderData.recipientName || null,
                    orderData.recipientPhone || null,
                    orderData.deliveryFee || 0.00
                ];
            }
            
            const [result] = await connection.execute(insertSql, insertParams);

            const orderId = result.insertId;

            // 创建订单商品明细
            // 支持两种字段名格式：productId/productName 或 product_id/product_name
            for (const item of orderData.items) {
                const productId = item.productId || item.product_id;
                const productName = item.productName || item.product_name;
                const price = Number(item.price) || 0;
                const quantity = Number(item.quantity) || 0;
                const subtotal = item.subtotal || (price * quantity);
                
                await connection.execute(
                    `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        productId,
                        productName,
                        price,
                        quantity,
                        subtotal
                    ]
                );
            }

            // 自动绑定订单到当天的配送任务（仅外送订单）
            if (orderType === 'takeaway') {
                try {
                    // 获取订单创建日期的字符串（YYYYMMDD格式），使用数据库的日期函数确保时区一致
                    // 注意：这里使用 NOW() 获取当前时间，因为订单刚创建，created_at 还未设置
                    // 如果订单的 created_at 被显式设置为其他日期，则应该根据订单的创建日期来查找任务
                    const [dateRows] = await connection.execute(
                        `SELECT DATE_FORMAT(NOW(), '%Y%m%d') as order_date`
                    );
                    const orderDateStr = dateRows[0]?.order_date || 
                        new Date().toISOString().split('T')[0].replace(/-/g, '');
                    const taskTitle = `auto${orderDateStr}`;
                    
                    console.log(`查找任务：商家=${merchantId}, 自动任务标题=${taskTitle}`);
                    
                    // 1）优先查找当日自动生成的配送任务（标题 autoYYYYMMDD）
                    const [autoTaskRows] = await connection.execute(
                        `SELECT task_id FROM task 
                         WHERE merchant_id = ? 
                           AND task_title = ? 
                           AND status IN (1, 2)
                         LIMIT 1`,
                        [merchantId, taskTitle]
                    );

                    let candidateTasks = autoTaskRows;
                    let bindSource = 'auto_task';

                    // 2）如果没有找到自动任务，则退而求其次，查找当日手动创建的“配送”任务
                    if (!candidateTasks || candidateTasks.length === 0) {
                        console.log(`未找到自动任务 (${taskTitle})，尝试查找当日手动创建的配送任务`);
                        const [manualTasks] = await connection.execute(
                            `SELECT task_id 
                               FROM task
                              WHERE merchant_id = ?
                                AND task_type = '配送'
                                AND DATE(start_time) <= CURDATE()
                                AND DATE(end_time) >= CURDATE()
                                AND status IN (1, 2)
                              ORDER BY start_time DESC
                              LIMIT 1`,
                            [merchantId]
                        );
                        if (manualTasks && manualTasks.length > 0) {
                            candidateTasks = manualTasks;
                            bindSource = 'manual_task';
                        }
                    }
                    
                    if (candidateTasks && candidateTasks.length > 0) {
                        const taskId = candidateTasks[0].task_id;
                        
                        // 绑定订单到任务
                        await connection.execute(
                            `INSERT IGNORE INTO task_orders (task_id, order_id)
                             VALUES (?, ?)`,
                            [taskId, orderId]
                        );
                        
                        // 更新任务的订单数量
                        await connection.execute(
                            `UPDATE task 
                             SET order_count = order_count + 1 
                             WHERE task_id = ?`,
                            [taskId]
                        );
                        
                        // 更新订单的task_id字段（冗余字段）
                        await connection.execute(
                            `UPDATE orders 
                             SET task_id = ? 
                             WHERE id = ?`,
                            [taskId, orderId]
                        );
                        
                        console.log(`订单 ${orderId} 已绑定到任务 ${taskId}（来源: ${bindSource}）`);
                    } else {
                        console.log(`未找到商家 ${merchantId} 今天的任何配送任务（自动任务标题: ${taskTitle}），订单 ${orderId} 未绑定任务`);
                    }
                } catch (bindError) {
                    // 绑定失败不影响订单创建
                    console.error('绑定订单到任务失败:', bindError);
                }
            }

            await connection.commit();

            return {
                success: true,
                data: {
                    orderId: orderId,
                    orderNo: orderNo,
                    items: orderData.items // 返回商品列表，用于删除购物车
                }
            };

        } catch (error) {
            await connection.rollback();
            console.error('创建订单失败:', error);
            throw new Error('创建订单失败: ' + error.message);
        } finally {
            connection.release();
        }
    }

    /**
     * 根据ID获取订单详情
     * @param {number} orderId 订单ID
     * @param {string} merchantId 商家ID（可选，用于权限检查）
     * @param {number} userId 用户ID（可选，用于权限检查）
     * @returns {Object|null} 订单详情
     */
    static async findById(orderId, merchantId = null, userId = null) {
        try {
            if (!orderId) {
                return null;
            }

            let sql = `
                SELECT o.*, 
                       u.nickname as user_nickname, 
                       u.avatar_url as user_avatar, 
                       u.phone as user_phone,
                       m.name as merchant_name,
                       m.logo as merchant_logo,
                       m.phone as merchant_phone,
                       m.address as merchant_address,
                       m.latitude as merchant_latitude,
                       m.longitude as merchant_longitude
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN merchants m ON o.merchant_id = m.id
                WHERE o.id = ?
            `;
            const params = [orderId];

            if (merchantId && typeof merchantId === 'string' && merchantId.trim() !== '') {
                sql += ' AND o.merchant_id = ?';
                params.push(merchantId.trim());
            } else if (userId !== null && userId !== undefined) {
                sql += ' AND o.user_id = ?';
                params.push(userId);
            }

            const [rows] = await db.execute(sql, params);
            if (rows.length === 0) {
                return null;
            }

            const order = rows[0];
            
            // 获取订单商品明细，包含商品图片
            const [items] = await db.execute(
                `SELECT oi.product_id, 
                        oi.product_name, 
                        oi.price, 
                        oi.quantity, 
                        oi.subtotal,
                        p.image_url as product_image,
                        c.name as category_name
                 FROM order_items oi
                 LEFT JOIN products p ON oi.product_id = p.id
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE oi.order_id = ?`,
                [orderId]
            );
            order.items = items;
            
            // 获取志愿者信息和接单时间（如果有）
            if (order.volunteer_id) {
                const [volunteerRows] = await db.execute(
                    `SELECT v.volunteer_id,
                            v.real_name as volunteer_name,
                            u.phone as volunteer_phone,
                            u.nickname as volunteer_nickname,
                            u.avatar_url as volunteer_avatar
                     FROM volunteer v
                     LEFT JOIN users u ON v.user_id = u.id
                     WHERE v.volunteer_id = ?`,
                    [order.volunteer_id]
                );
                if (volunteerRows.length > 0) {
                    order.volunteer = volunteerRows[0];
                }
                
                // 获取志愿者接单时间
                const [orderVolunteerRows] = await db.execute(
                    `SELECT accept_time, pickup_time, delivery_time, status as delivery_status
                     FROM order_volunteer
                     WHERE order_id = ?
                     LIMIT 1`,
                    [orderId]
                );
                if (orderVolunteerRows.length > 0) {
                    order.volunteer_accept_time = orderVolunteerRows[0].accept_time;
                    order.volunteer_pickup_time = orderVolunteerRows[0].pickup_time;
                    order.volunteer_delivery_time = orderVolunteerRows[0].delivery_time;
                    order.volunteer_delivery_status = orderVolunteerRows[0].delivery_status;
                }
            }

            return order;
        } catch (error) {
            console.error('查找订单详情失败:', error);
            throw new Error('查找订单详情失败');
        }
    }

    /**
     * 获取用户最近的订单
     * @param {number} userId 用户ID
     * @param {number} limit 返回数量
     * @returns {Array} 订单列表
     */
    static async getRecentOrdersByUserId(userId, limit = 3) {
        try {
            const numericUserId = Number.parseInt(userId, 10);
            const numericLimit = Number.parseInt(limit, 10);

            if (!Number.isFinite(numericUserId)) {
                throw new Error(`用户ID无效: ${userId}`);
            }

            const appliedLimit = Number.isFinite(numericLimit) && numericLimit > 0 ? numericLimit : 3;

            const [rows] = await db.execute(
                `SELECT 
                    o.id,
                    o.order_no,
                    o.status,
                    o.created_at,
                    (
                        SELECT product_name 
                        FROM order_items 
                        WHERE order_id = o.id 
                        ORDER BY id ASC 
                        LIMIT 1
                    ) AS first_product_name
                 FROM orders o
                 WHERE o.user_id = ?
                 ORDER BY o.created_at DESC, o.id DESC
                 LIMIT ?`,
                [numericUserId, appliedLimit]
            );
            return rows;
        } catch (error) {
            console.error('获取用户近期订单失败:', error);
            throw new Error('获取用户近期订单失败');
        }
    }

    /**
     * 获取用户订单列表
     * @param {number} userId 用户ID
     * @param {string} status 订单状态（可选）
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @returns {Object} 订单列表
     */
    static async findByUserId(userId, status = null, page = 1, limit = 10) {
        try {
            console.log('查找用户订单列表, userId:', userId);

            let sql = `
                SELECT o.*, m.name as merchant_name, m.logo as merchant_logo,
                       u.nickname as user_nickname, u.avatar_url as user_avatar, u.phone as user_phone,
                       IFNULL(
                           JSON_ARRAYAGG(
                               JSON_OBJECT(
                                   'product_id', oi.product_id,
                                   'product_name', oi.product_name,
                                   'price', oi.price,
                                   'quantity', oi.quantity,
                                   'subtotal', oi.subtotal,
                                   'image_url', p.image_url,
                                   'specification', p.description,
                                   'category_name', c.name
                               )
                           ),
                           '[]'
                       ) as items
                FROM orders o
                LEFT JOIN merchants m ON o.merchant_id = m.id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.id
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE o.user_id = ?
            `;
            let params = [userId];

            // 如果提供了状态筛选参数
            if (status && status !== null && status !== undefined && status.toString().trim() !== '') {
                sql += ' AND o.status = ?';
                params.push(status);
            }

            sql += ' GROUP BY o.id ORDER BY o.created_at DESC';

            const offset = (page - 1) * limit;
            sql += ` LIMIT ${limit} OFFSET ${offset}`;

            const [rows] = await db.execute(sql, params);

            // 处理订单商品数据
            const orders = rows.map(order => {
                try {
                    if (order.items) {
                        // 如果 items 是字符串，需要解析
                        if (typeof order.items === 'string') {
                            order.items = JSON.parse(order.items);
                        } 
                        // 如果 items 已经是数组或对象，直接使用
                        else if (Array.isArray(order.items)) {
                            // 已经是数组，无需处理
                        }
                        // 如果 items 是 null 或其他类型，设为空数组
                        else {
                            order.items = [];
                        }
                    } else {
                        order.items = [];
                    }
                } catch (error) {
                    console.error('解析订单商品数据失败:', error, 'items:', order.items);
                    order.items = [];
                }
                return order;
            });

            // 获取总数
            let countSql = 'SELECT COUNT(*) as total FROM orders WHERE user_id = ?';
            let countParams = [userId];

            if (status && status !== null && status !== undefined && status.toString().trim() !== '') {
                countSql += ' AND status = ?';
                countParams.push(status);
            }

            const [countRows] = await db.execute(countSql, countParams);
            const total = countRows[0].total;

            return {
                success: true,
                data: {
                    orders: orders,
                    pagination: {
                        page: page,
                        limit: limit,
                        total: total,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            };

        } catch (error) {
            console.error('查找用户订单列表失败:', error);
            throw new Error('查找用户订单列表失败: ' + error.message);
        }
    }

    /**
     * 获取用户订单列表（别名方法，与控制器保持一致）
     * @param {number} userId 用户ID
     * @param {string} status 订单状态（可选）
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @returns {Object} 订单列表
     */
    static async getUserOrders(userId, status = null, page = 1, limit = 10) {
        return this.findByUserId(userId, status, page, limit);
    }

    /**
     * 更新订单状态
     * @param {number} orderId 订单ID
     * @param {string} status 订单状态
     * @param {string} merchantId 商家ID（可选，用于权限检查）
     * @param {string} remark 备注（可选）
     * @param {number} operatorId 操作人用户ID（可选，用于记录轨迹）
     * @param {string} operatorRole 操作人角色（user/merchant/volunteer/system）
     * @returns {Object} 更新结果
     */
    static async updateStatus(orderId, status, merchantId = null, remark = null, operatorId = null, operatorRole = 'system') {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 权限检查并获取订单信息
            const [orderInfo] = await connection.execute(
                'SELECT merchant_id, order_type, pickup_number, status FROM orders WHERE id = ?',
                [orderId]
            );

            if (orderInfo.length === 0) {
                throw new Error('订单不存在');
            }

            const order = orderInfo[0];
            
            // 商家权限检查
            if (merchantId !== null && order.merchant_id !== merchantId) {
                throw new Error('无权限操作此订单');
            }

            const oldStatus = order.status;

            let sql = 'UPDATE orders SET status = ?';
            let params = [status];

            if (status === 'completed') {
                sql += ', payment_time = NOW()';
            }

            // 如果是在店就餐订单且没有取餐码，生成取餐码
            if (order.order_type === 'dine_in' && !order.pickup_number) {
                const pickupNumber = await this.generatePickupNumber(order.merchant_id);
                sql += ', pickup_number = ?';
                params.push(pickupNumber);
                console.log('更新订单状态时生成取餐码:', pickupNumber);
            }

            if (remark !== null) {
                sql += ', remark = ?';
                params.push(remark);
            }

            sql += ', updated_at = NOW() WHERE id = ?';
            params.push(orderId);

            const [result] = await connection.execute(sql, params);

            if (result.affectedRows === 0) {
                throw new Error('订单更新失败');
            }

            // 写入状态变更轨迹
            await connection.execute(
                `INSERT INTO order_status_logs (order_id, operator_id, operator_role, from_status, to_status, remark)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    operatorId,
                    operatorRole,
                    oldStatus,
                    status,
                    remark || null
                ]
            );

            await connection.commit();

            return {
                success: true,
                message: '订单状态更新成功'
            };

        } catch (error) {
            await connection.rollback();
            console.error('更新订单状态失败:', error);
            throw new Error('更新订单状态失败: ' + error.message);
        } finally {
            connection.release();
        }
    }

    /**
     * 获取订单状态变更轨迹
     * @param {number} orderId 订单ID
     * @returns {Array} 轨迹列表
     */
    static async getStatusLogs(orderId) {
        try {
            const [rows] = await db.execute(
                `SELECT 
                    id,
                    order_id,
                    operator_id,
                    operator_role,
                    from_status,
                    to_status,
                    remark,
                    created_at
                 FROM order_status_logs
                 WHERE order_id = ?
                 ORDER BY created_at ASC, id ASC`,
                [orderId]
            );
            return rows;
        } catch (error) {
            console.error('获取订单状态变更轨迹失败:', error);
            throw new Error('获取订单状态变更轨迹失败');
        }
    }

    /**
     * 取消订单
     * @param {number} orderId 订单ID
     * @param {number} userId 用户ID（用于权限检查）
     * @returns {Object} 取消结果
     */
    static async cancelOrder(orderId, userId) {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 查询订单信息
            const [orderRows] = await connection.execute(
                'SELECT id, user_id, status FROM orders WHERE id = ?',
                [orderId]
            );

            if (orderRows.length === 0) {
                throw new Error('订单不存在、无权限操作或订单状态不允许取消');
            }

            const order = orderRows[0];

            // 权限检查：订单必须属于该用户
            if (order.user_id !== userId) {
                throw new Error('订单不存在、无权限操作或订单状态不允许取消');
            }

            // 检查订单状态是否允许取消
            // 只有 pending 或 paid 状态的订单可以取消
            const allowedStatuses = ['pending', 'paid'];
            if (!allowedStatuses.includes(order.status)) {
                throw new Error('订单不存在、无权限操作或订单状态不允许取消');
            }

            const oldStatus = order.status;

            // 更新订单状态为 cancelled
            const [updateResult] = await connection.execute(
                'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
                ['cancelled', orderId]
            );

            if (updateResult.affectedRows === 0) {
                throw new Error('订单不存在、无权限操作或订单状态不允许取消');
            }

            // 记录状态变更轨迹
            await connection.execute(
                `INSERT INTO order_status_logs (order_id, operator_id, operator_role, from_status, to_status, remark)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    userId,
                    'user',
                    oldStatus,
                    'cancelled',
                    '用户取消订单'
                ]
            );

            await connection.commit();

            return {
                success: true,
                message: '订单已成功取消'
            };

        } catch (error) {
            await connection.rollback();
            console.error('取消订单失败:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 删除订单（用户删除已取消的订单）
     * @param {number} orderId 订单ID
     * @param {number} userId 用户ID（用于权限检查）
     * @returns {Object} 删除结果
     */
    static async deleteOrder(orderId, userId) {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 查询订单信息
            const [orderRows] = await connection.execute(
                'SELECT id, user_id, status FROM orders WHERE id = ?',
                [orderId]
            );

            if (orderRows.length === 0) {
                throw new Error('订单不存在、无权限操作或订单状态不允许删除');
            }

            const order = orderRows[0];

            // 权限检查：订单必须属于该用户
            if (order.user_id !== userId) {
                throw new Error('订单不存在、无权限操作或订单状态不允许删除');
            }

            // 检查订单状态：只有已取消的订单可以删除
            if (order.status !== 'cancelled') {
                throw new Error('订单不存在、无权限操作或订单状态不允许删除');
            }

            // 删除订单商品明细
            await connection.execute(
                'DELETE FROM order_items WHERE order_id = ?',
                [orderId]
            );

            // 删除订单状态日志
            await connection.execute(
                'DELETE FROM order_status_logs WHERE order_id = ?',
                [orderId]
            );

            // 删除订单
            const [result] = await connection.execute(
                'DELETE FROM orders WHERE id = ?',
                [orderId]
            );

            if (result.affectedRows === 0) {
                throw new Error('订单不存在、无权限操作或订单状态不允许删除');
            }

            await connection.commit();

            return {
                success: true,
                message: '订单已成功删除'
            };

        } catch (error) {
            await connection.rollback();
            console.error('删除订单失败:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 删除订单（通用方法，支持商家和用户）
     * @param {number} orderId 订单ID
     * @param {string} merchantId 商家ID（可选，用于权限检查）
     * @param {number} userId 用户ID（可选，用于权限检查）
     * @returns {Object} 删除结果
     */
    static async delete(orderId, merchantId = null, userId = null) {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            let sql = 'SELECT 1 FROM orders WHERE id = ?';
            let params = [orderId];

            // 权限检查：优先检查商家权限
            if (merchantId !== null && merchantId !== undefined) {
                sql += ' AND merchant_id = ?';
                params.push(merchantId);
            } else if (userId !== null && userId !== undefined) {
                // 如果没有商家权限，检查用户权限
                sql += ' AND user_id = ?';
                params.push(userId);
            }

            // 检查订单是否存在且有权限
            const [checkResult] = await connection.execute(sql, params);

            if (checkResult.length === 0) {
                throw new Error('订单不存在或无权限操作');
            }

            // 删除订单商品明细
            await connection.execute(
                'DELETE FROM order_items WHERE order_id = ?',
                [orderId]
            );

            // 删除订单
            const [result] = await connection.execute(
                'DELETE FROM orders WHERE id = ?',
                [orderId]
            );

            if (result.affectedRows === 0) {
                throw new Error('订单删除失败');
            }

            await connection.commit();

            return {
                success: true,
                message: '订单删除成功'
            };
        } catch (error) {
            await connection.rollback();
            console.error('删除订单失败:', error);
            throw new Error('删除订单失败');
        } finally {
            connection.release();
        }
    }

    /**
     * 获取商家订单列表
     * @param {string} merchantId 商家ID
     * @param {string} status 订单状态（可选）
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @returns {Object} 订单列表
     */
    static async getMerchantOrders(merchantId, status = null, page = 1, limit = 10) {
        console.log('*** 开始执行 getMerchantOrders ***');
        console.log('*** getMerchantOrders 原始入参:', { merchantId, status, page, limit });
        
        try {
            // 兼容两种商家标识：
            // 1）直接传 merchants.id（如 MER10001）
            // 2）传商家关联的用户ID（如 3），需要先映射到 merchants.id
            if (!merchantId) {
                console.log('merchantId 为空，使用默认测试商家 MER10001');
                merchantId = 'MER10001';
            } else {
                const rawId = merchantId.toString().trim();
                // 如果是纯数字，很可能是 user_id，需要映射到 merchants.id
                if (/^[0-9]+$/.test(rawId)) {
                    console.log('检测到数字型 merchantId，尝试通过 user_id 映射到 merchants.id，rawId =', rawId);
                    try {
                        const [rows] = await db.execute(
                            'SELECT id FROM merchants WHERE user_id = ? LIMIT 1',
                            [parseInt(rawId, 10)]
                        );
                        if (rows && rows.length > 0 && rows[0].id) {
                            console.log('通过 user_id 成功映射到商家ID:', rows[0].id);
                            merchantId = rows[0].id;
                        } else {
                            console.warn('根据 user_id 未找到对应的商家记录，继续使用原始 merchantId:', merchantId);
                        }
                    } catch (mapError) {
                        console.warn('根据 user_id 映射商家ID失败，继续使用原始 merchantId:', merchantId, '错误:', mapError.message);
                    }
                }
            }

            console.log('*** getMerchantOrders 规范化后的 merchantId:', merchantId);
            console.log('*** 开始查询订单基本信息 ***');
            
            let baseSql = `
                SELECT o.*, 
                       u.nickname as user_nickname, u.avatar_url as user_avatar, u.phone as user_phone
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                WHERE o.merchant_id = ?
            `;
            let params = [merchantId];

            if (status && status !== null && status !== undefined && status.toString().trim() !== '') {
                baseSql += ' AND o.status = ?';
                params.push(status);
            }

            console.log('*** 查询SQL:', baseSql);
            console.log('*** 查询参数:', params);

            const [orders] = await db.execute(baseSql, params);
            console.log('*** 查询到订单数量:', orders.length);
            console.log('*** 订单数据:', orders);

            // 为每个订单查询商品明细
            for (let order of orders) {
                console.log('*** 查询订单ID', order.id, '的商品明细');
                const [items] = await db.execute(
                    'SELECT product_id, product_name, price, quantity, subtotal FROM order_items WHERE order_id = ?',
                    [order.id]
                );
                order.items = items;
                console.log('*** 订单', order.id, '的商品明细:', items);
            }

            // 查询总数
            console.log('*** 开始查询总数 ***');
            let countSql = 'SELECT COUNT(*) as total FROM orders WHERE merchant_id = ?';
            let countParams = [merchantId];

            if (status && status !== null && status !== undefined && status.toString().trim() !== '') {
                countSql += ' AND status = ?';
                countParams.push(status);
            }

            console.log('*** 总数查询SQL:', countSql);
            console.log('*** 总数查询参数:', countParams);

            const [countRows] = await db.execute(countSql, countParams);
            const total = countRows[0].total;
            console.log('*** 总数查询结果:', total);

            const result = {
                success: true,
                data: {
                    orders: orders,
                    pagination: {
                        page: page,
                        limit: limit,
                        total: total,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            };

            console.log('*** getMerchantOrders 执行成功，返回结果:', result);
            return result;

        } catch (error) {
            console.error('*** getMerchantOrders 执行失败 ***');
            console.error('*** 错误信息:', error.message);
            console.error('*** 错误堆栈:', error.stack);
            console.error('*** 错误参数:', { merchantId, status, page, limit });
            throw new Error('获取商家订单列表失败: ' + error.message);
        }
    }

    /**
     * 获取商家统计信息（今日订单数量和营收）
     * @param {string} merchantId 商家ID
     * @returns {Object} 统计数据
     */
    static async getMerchantStats(merchantId) {
        try {
            console.log('获取商家统计数据, merchantId:', merchantId);
            
            if (!merchantId) {
                throw new Error('缺少商家ID，无法统计订单数据');
            }
            
            // 定义需要排除的订单状态（如已取消、已退款）
            const excludedStatuses = ['cancelled', 'refunded'];
            const placeholders = excludedStatuses.map(() => '?').join(', ');
            
            // 查询今日订单数量和积分（营收）总额
            const todayParams = [merchantId, ...excludedStatuses];
            const [todayRows] = await db.execute(
                `SELECT 
                    COUNT(*) AS todayOrders,
                    COALESCE(SUM(total_amount), 0) AS todayRevenue
                 FROM orders
                 WHERE merchant_id = ?
                   AND DATE(created_at) = CURDATE()
                   AND status NOT IN (${placeholders})
                `,
                todayParams
            );
            
            // 查询当月订单数量和积分（营收）总额
            const monthlyParams = [merchantId, ...excludedStatuses];
            const [monthlyRows] = await db.execute(
                `SELECT 
                    COUNT(*) AS monthlyOrders,
                    COALESCE(SUM(total_amount), 0) AS monthlyRevenue
                 FROM orders
                 WHERE merchant_id = ?
                   AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
                   AND status NOT IN (${placeholders})
                `,
                monthlyParams
            );
            
            const todayStats = todayRows[0] || { todayOrders: 0, todayRevenue: 0 };
            const monthlyStats = monthlyRows[0] || { monthlyOrders: 0, monthlyRevenue: 0 };
            
            const todayOrders = parseInt(todayStats.todayOrders, 10) || 0;
            const todayRevenue = parseFloat(todayStats.todayRevenue) || 0;
            const monthlyOrders = parseInt(monthlyStats.monthlyOrders, 10) || 0;
            const monthlyRevenue = parseFloat(monthlyStats.monthlyRevenue) || 0;
            const avgOrderValue = monthlyOrders > 0 ? parseFloat((monthlyRevenue / monthlyOrders).toFixed(2)) : 0;
            
            console.log('商家统计数据查询结果:', {
                todayOrders,
                todayRevenue,
                monthlyOrders,
                monthlyRevenue,
                avgOrderValue
            });
            
            return {
                success: true,
                data: {
                    todayOrders,
                    todayRevenue,
                    date: new Date().toISOString().slice(0, 10),
                    monthlyOrders,
                    monthlyRevenue,
                    avgOrderValue,
                    satisfactionRate: 90
                }
            };
            
        } catch (error) {
            console.error('获取商家统计数据失败:', error);
            throw new Error('获取商家统计数据失败: ' + error.message);
        }
    }

    /**
     * 生成订单号
     * @returns {string} 订单号
     */
    static generateOrderNo() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

        return `WD${year}${month}${day}${hour}${minute}${second}${random}`;
    }

    /**
     * 生成取餐码
     * @param {string} merchantId 商家ID
     * @returns {string} 取餐码（格式：0001, 0002...）
     */
    static async generatePickupNumber(merchantId) {
        try {
            // 获取今天的日期
            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10); // 格式：YYYY-MM-DD
            
            // 查询今天该商家已生成的最大取餐码
            const [rows] = await db.execute(
                `SELECT pickup_number 
                 FROM orders 
                 WHERE merchant_id = ? 
                   AND DATE(created_at) = ? 
                   AND order_type = 'dine_in' 
                   AND pickup_number IS NOT NULL 
                 ORDER BY pickup_number DESC 
                 LIMIT 1`,
                [merchantId, todayStr]
            );
            
            let nextNumber = 1;
            if (rows.length > 0) {
                // 提取数字部分并加1
                const lastNumber = parseInt(rows[0].pickup_number);
                nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
            }
            
            // 格式化为4位数，不足前面补0
            return String(nextNumber).padStart(4, '0');
        } catch (error) {
            console.error('生成取餐码失败:', error);
            // 如果发生错误，返回一个默认值
            return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        }
    }
}

module.exports = Order;