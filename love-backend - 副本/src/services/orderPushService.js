const db = require('../config/database');
const User = require('../models/User');
const ElderlyInfo = require('../models/ElderlyInfo');

/**
 * 订单推送服务
 * 当子女下单后，自动推送订单信息到收货老人的手机
 */
class OrderPushService {
    /**
     * 推送订单信息给老人
     * @param {Object} orderData 订单数据
     * @param {number} orderId 订单ID
     * @param {number} userId 下单用户ID
     * @returns {Promise<Object>} 推送结果
     */
    static async pushOrderToElderly(orderData, orderId, userId) {
        try {
            console.log('开始处理订单推送，订单ID:', orderId, '下单用户ID:', userId);
            
            // 1. 检查下单用户是否是子女（role_id=4）
            const user = await User.findById(userId);
            if (!user || user.role_id !== 4) {
                console.log('下单用户不是子女角色，跳过推送');
                return { success: false, reason: '下单用户不是子女角色' };
            }
            
            console.log('下单用户是子女，继续处理推送');
            
            // 2. 检查订单类型和收货信息
            if (orderData.orderType !== 'takeaway' || !orderData.recipientPhone) {
                console.log('订单不是外送订单或缺少收货电话，跳过推送');
                return { success: false, reason: '订单不是外送订单或缺少收货电话' };
            }
            
            const recipientPhone = orderData.recipientPhone.trim();
            console.log('订单收货电话:', recipientPhone);
            
            // 3. 查找匹配的老人信息
            // 通过elderly_info表的user_old_phone或关联的users表的phone匹配
            const [elderlyRows] = await db.execute(
                `SELECT ei.*, u.nickname as user_nickname, u.phone as user_phone
                 FROM elderly_info ei
                 LEFT JOIN users u ON ei.user_id = u.id
                 WHERE ei.user_old_phone = ? OR u.phone = ?
                 LIMIT 1`,
                [recipientPhone, recipientPhone]
            );
            
            if (elderlyRows.length === 0) {
                console.log('未找到匹配的老人信息，跳过推送');
                return { success: false, reason: '未找到匹配的老人信息' };
            }
            
            const elderlyInfo = elderlyRows[0];
            console.log('找到匹配的老人信息:', elderlyInfo);
            
            // 4. 验证子女-老人关系
            if (elderlyInfo.child_id !== userId) {
                console.log('子女-老人关系不匹配，跳过推送');
                return { success: false, reason: '子女-老人关系不匹配' };
            }
            
            // 5. 获取订单商品信息
            const [orderItems] = await db.execute(
                `SELECT product_name, quantity, price
                 FROM order_items
                 WHERE order_id = ?`,
                [orderId]
            );
            
            const productNames = orderItems.map(item => item.product_name).join('、');
            
            // 6. 构建推送消息
            const pushMessage = this.buildPushMessage({
                elderlyName: elderlyInfo.user_name || elderlyInfo.user_nickname || '您',
                childName: user.nickname || '您的子女',
                orderNo: orderData.orderNo || `订单${orderId}`,
                productNames: productNames || '餐品',
                totalAmount: orderData.totalAmount || 0,
                deliveryAddress: orderData.deliveryAddress || '',
                scheduledDeliveryTime: orderData.scheduledDeliveryTime || '尽快配送',
                status: '已下单待配送'
            });
            
            console.log('构建的推送消息:', pushMessage);
            
            // 7. 记录推送日志
            await this.logPush(orderId, recipientPhone, pushMessage, 'pending');
            
            // 8. 执行推送（这里先记录日志，实际推送需要集成第三方服务）
            const pushResult = await this.sendPush(recipientPhone, pushMessage);
            
            // 9. 更新推送日志状态
            await this.updatePushLog(orderId, pushResult.success ? 'success' : 'failed', pushResult.error || null);
            
            return pushResult;
            
        } catch (error) {
            console.error('订单推送处理失败:', error);
            // 记录错误日志
            try {
                await this.logPush(orderId, orderData.recipientPhone || '', '', 'failed', error.message);
            } catch (logError) {
                console.error('记录推送日志失败:', logError);
            }
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 构建推送消息内容
     */
    static buildPushMessage(data) {
        return `【爱心餐订单提醒】

您好${data.elderlyName}，您的子女${data.childName}为您下单啦！

订单号：${data.orderNo}
餐品：${data.productNames}
总金额：${data.totalAmount}元
配送地址：${data.deliveryAddress}
预计配送时间：${data.scheduledDeliveryTime}
订单状态：${data.status}`;
    }
    
    /**
     * 发送推送（实际实现需要集成第三方服务）
     * 这里先模拟，实际应该调用短信服务或推送服务
     */
    static async sendPush(phone, message) {
        try {
            // TODO: 集成实际的推送服务
            // 例如：阿里云短信、极光推送等
            console.log('模拟推送消息到手机:', phone);
            console.log('推送内容:', message);
            
            // 这里可以调用实际的推送API
            // const result = await smsService.send(phone, message);
            
            // 模拟推送成功
            return { success: true };
        } catch (error) {
            console.error('推送发送失败:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 记录推送日志
     */
    static async logPush(orderId, phone, message, status, error = null) {
        try {
            // 检查是否已存在推送日志表，如果不存在则创建
            await db.execute(`
                CREATE TABLE IF NOT EXISTS order_push_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    order_id INT NOT NULL,
                    push_phone VARCHAR(20) NOT NULL,
                    push_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    push_content TEXT,
                    push_status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_order_id (order_id),
                    INDEX idx_push_time (push_time)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单推送日志表'
            `);
            
            // 插入推送日志
            await db.execute(
                `INSERT INTO order_push_logs (order_id, push_phone, push_content, push_status, error_message)
                 VALUES (?, ?, ?, ?, ?)`,
                [orderId, phone, message, status, error]
            );
            
            console.log('推送日志已记录');
        } catch (error) {
            console.error('记录推送日志失败:', error);
            // 不抛出错误，避免影响主流程
        }
    }
    
    /**
     * 更新推送日志状态
     */
    static async updatePushLog(orderId, status, error = null) {
        try {
            await db.execute(
                `UPDATE order_push_logs 
                 SET push_status = ?, error_message = ?, push_time = NOW()
                 WHERE order_id = ? 
                 ORDER BY id DESC 
                 LIMIT 1`,
                [status, error, orderId]
            );
        } catch (error) {
            console.error('更新推送日志失败:', error);
        }
    }
}

module.exports = OrderPushService;

