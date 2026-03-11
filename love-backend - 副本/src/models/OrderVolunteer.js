const db = require('../config/database');

class OrderVolunteer {
    /**
     * 根据订单ID获取配送绑定记录
     */
    static async findByOrderId(orderId, options = {}) {
        const { connection = null, forUpdate = false } = options;
        const query = `
            SELECT id, order_id, volunteer_id, task_id, accept_time, pickup_time, delivery_time, status, remark
            FROM order_volunteer
            WHERE order_id = ?
            LIMIT 1
            ${forUpdate ? 'FOR UPDATE' : ''}
        `;
        const executor = connection ? connection.execute.bind(connection) : db.execute.bind(db);
        const [rows] = await executor(query, [orderId]);
        return rows[0] || null;
    }

    /**
     * 为订单分配志愿者（唯一约束 order_id）
     */
    static async assign(orderId, volunteerId, taskId, connection = null) {
        const query = `
            INSERT INTO order_volunteer (order_id, volunteer_id, task_id, status, accept_time)
            VALUES (?, ?, ?, 'accepted', NOW())
        `;
        const executor = connection ? connection.execute.bind(connection) : db.execute.bind(db);
        try {
            await executor(query, [orderId, volunteerId, taskId]);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                const conflict = new Error('ORDER_ALREADY_ASSIGNED');
                conflict.code = 'ORDER_ALREADY_ASSIGNED';
                throw conflict;
            }
            throw err;
        }
    }

    /**
     * 更新订单配送状态（同步取餐/送达时间）
     */
    static async updateStatus(orderId, status, options = {}, connection = null) {
        const sets = ['status = ?'];
        const params = [status];

        if (status === 'picked' || options.forcePickupTime) {
            sets.push('pickup_time = ?');
            params.push(options.pickup_time || new Date());
        }

        if (status === 'delivered' || options.forceDeliveryTime) {
            sets.push('delivery_time = ?');
            params.push(options.delivery_time || new Date());
        }

        if (options.remark !== undefined) {
            sets.push('remark = ?');
            params.push(options.remark);
        }

        params.push(orderId);

        const query = `
            UPDATE order_volunteer
            SET ${sets.join(', ')}
            WHERE order_id = ?
        `;

        const executor = connection ? connection.execute.bind(connection) : db.execute.bind(db);
        await executor(query, params);
    }

    static async removeByOrder(orderId, connection = null) {
        const executor = connection ? connection.execute.bind(connection) : db.execute.bind(db);
        await executor('DELETE FROM order_volunteer WHERE order_id = ?', [orderId]);
    }
}

module.exports = OrderVolunteer;

