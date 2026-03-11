const db = require('../config/database');

class TaskModel {
    constructor() {
        this.tableName = 'task';
    }

    async getTaskList({ volunteerId = null, merchantId = null } = {}) {
        try {
            const params = [];
            let volunteerSelect = ', 0 AS is_claimed';
            let volunteerJoin = '';

            if (volunteerId) {
                volunteerSelect = ', CASE WHEN tv_user.volunteer_id IS NULL THEN 0 ELSE 1 END AS is_claimed';
                volunteerJoin = 'LEFT JOIN task_volunteer tv_user ON tv_user.task_id = t.task_id AND tv_user.volunteer_id = ?';
                params.push(volunteerId);
            }

            let whereClause = 'WHERE t.status IN (1, 2, 3, 4)';

            if (merchantId) {
                whereClause += ' AND t.merchant_id = ?';
                params.push(merchantId);
            }

            const query = `
                SELECT 
                    t.task_id,
                    t.merchant_id,
                    t.contact_name,
                    t.contact_phone,
                    t.task_title,
                    t.task_content,
                    t.task_type,
                    t.require_num,
                    t.start_time,
                    t.end_time,
                    t.address,
                    t.status,
                    t.created_at,
                    m.name AS merchant_name,
                    m.phone AS merchant_phone,
                    IFNULL(tv_stats.assigned_count, 0) AS assigned_count,
                    IFNULL(to_stats.order_count, 0) AS order_count
                    ${volunteerSelect}
                FROM ${this.tableName} t
                LEFT JOIN merchants m ON t.merchant_id = m.id
                LEFT JOIN (
                    SELECT task_id, COUNT(*) AS assigned_count
                    FROM task_volunteer
                    WHERE status IN (1, 2)
                    GROUP BY task_id
                ) tv_stats ON tv_stats.task_id = t.task_id
                LEFT JOIN (
                    SELECT task_id, COUNT(*) AS order_count
                    FROM task_orders
                    GROUP BY task_id
                ) to_stats ON to_stats.task_id = t.task_id
                ${volunteerJoin}
                ${whereClause}
                ORDER BY t.start_time ASC
            `;

            const rows = await db.query(query, params);
            return rows;
        } catch (error) {
            console.error('获取任务列表失败:', error);
            throw error;
        }
    }

    async getTaskById(taskId) {
        try {
            const query = `
                SELECT 
                    t.*,
                    m.name AS merchant_name,
                    m.phone AS merchant_phone
                FROM ${this.tableName} t
                LEFT JOIN merchants m ON t.merchant_id = m.id
                WHERE t.task_id = ?
            `;
            const rows = await db.query(query, [taskId]);
            return rows[0] || null;
        } catch (error) {
            console.error('获取任务详情失败:', error);
            throw error;
        }
    }

    async createTask(data) {
        try {
            const query = `
                INSERT INTO ${this.tableName} (
                    merchant_id,
                    contact_name,
                    contact_phone,
                    task_title,
                    task_content,
                    task_type,
                    require_num,
                    start_time,
                    end_time,
                    address,
                    delivery_fee,
                    max_delivery_distance,
                    delivery_deadline,
                    order_count,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                data.merchant_id,
                data.contact_name || '',
                data.contact_phone || '',
                data.task_title,
                data.task_content,
                data.task_type,
                data.require_num || 0,
                data.start_time,
                data.end_time,
                data.address,
                data.delivery_fee || 0.00,
                data.max_delivery_distance || 5.00,
                data.delivery_deadline || null,
                data.order_count || 0,
                data.status || 1
            ];

            const result = await db.query(query, values);
            const taskId = result.insertId;

            // 创建配送类任务时，尝试自动关联当日未绑定的外送订单
            if (data.task_type === '配送' && data.merchant_id) {
                try {
                    console.log('开始为新建配送任务自动关联当日外送订单:', {
                        taskId,
                        merchantId: data.merchant_id
                    });

                    // 1）将当天该商家、尚未绑定任务的外送订单写入 task_orders
                    await db.query(
                        `INSERT IGNORE INTO task_orders (task_id, order_id)
                         SELECT ?, o.id
                           FROM orders o
                          WHERE o.merchant_id = ?
                            AND o.order_type = 'takeaway'
                            AND o.task_id IS NULL
                            AND DATE(o.created_at) = CURDATE()`,
                        [taskId, data.merchant_id]
                    );

                    // 2）根据 task_orders 重新计算并更新任务的 order_count
                    await db.query(
                        `UPDATE ${this.tableName} t
                            SET t.order_count = (
                                SELECT COUNT(*)
                                  FROM task_orders tor
                                 WHERE tor.task_id = t.task_id
                            )
                          WHERE t.task_id = ?`,
                        [taskId]
                    );

                    // 3）同步更新 orders 表中的冗余字段 task_id
                    await db.query(
                        `UPDATE orders o
                          JOIN task_orders tor ON tor.order_id = o.id
                           SET o.task_id = tor.task_id
                         WHERE tor.task_id = ?`,
                        [taskId]
                    );

                    console.log('新建配送任务自动关联当日订单完成，任务ID:', taskId);
                } catch (bindError) {
                    // 绑定失败不影响任务创建
                    console.error('为新建配送任务批量关联订单失败:', bindError);
                }
            }

            return { task_id: taskId, ...data };
        } catch (error) {
            console.error('创建任务失败:', error);
            throw error;
        }
    }

    async updateTask(taskId, merchantId, data) {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 检查任务当前状态
            const [currentTask] = await connection.execute(
                `SELECT status FROM ${this.tableName} WHERE task_id = ? AND merchant_id = ?`,
                [taskId, merchantId]
            );

            if (currentTask.length === 0) {
                await connection.rollback();
                return false;
            }

            const oldStatus = currentTask[0].status;
            const newStatus = data.status !== undefined ? Number(data.status) : undefined;

            const fields = [];
            const params = [];

            Object.keys(data).forEach(key => {
                if (data[key] !== undefined) {
                    fields.push(`${key} = ?`);
                    params.push(data[key]);
                }
            });

            if (fields.length === 0) {
                await connection.rollback();
                return false;
            }

            params.push(taskId, merchantId);

            const query = `
                UPDATE ${this.tableName}
                SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE task_id = ? AND merchant_id = ?
            `;

            const [result] = await connection.execute(query, params);
            
            // 如果任务状态从非3变为3（标记为已完成），更新志愿者的服务时长
            if (newStatus !== undefined && oldStatus !== 3 && newStatus === 3) {
                console.log(`任务 ${taskId} 状态从 ${oldStatus} 变为 ${newStatus}（已完成），开始更新志愿者的服务时长`);
                const TaskVolunteer = require('./TaskVolunteer');
                await TaskVolunteer.updateServiceHoursOnTaskComplete(taskId, connection);
            }

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('更新任务失败:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    async deleteTask(taskId, merchantId) {
        try {
            const query = `DELETE FROM ${this.tableName} WHERE task_id = ? AND merchant_id = ?`;
            const result = await db.query(query, [taskId, merchantId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('删除任务失败:', error);
            throw error;
        }
    }

    async getTaskOrders(taskId) {
        try {
            const query = `
                SELECT 
                    o.id AS order_id,
                    o.order_no,
                    o.status,
                    o.delivery_address,
                    o.recipient_name,
                    o.recipient_phone,
                    o.total_amount,
                    o.delivery_fee,
                    o.created_at,
                    o.updated_at,
                    o.order_type,
                    o.remark,
                    ov.volunteer_id AS assigned_volunteer_id,
                    ov.status AS volunteer_delivery_status,
                    ov.accept_time,
                    ov.pickup_time,
                    ov.delivery_time,
                    u.nickname AS volunteer_name
                FROM task_orders tor
                INNER JOIN orders o ON o.id = tor.order_id
                LEFT JOIN order_volunteer ov ON ov.order_id = o.id
                LEFT JOIN volunteer v ON v.volunteer_id = ov.volunteer_id
                LEFT JOIN users u ON u.id = v.user_id
                WHERE tor.task_id = ?
                ORDER BY o.created_at ASC
            `;
            return await db.query(query, [taskId]);
        } catch (error) {
            console.error('获取任务关联订单失败:', error);
            throw error;
        }
    }

    /**
     * 通过订单ID查找任务ID
     * @param {number} orderId 订单ID
     * @returns {number|null} 任务ID，如果不存在则返回null
     */
    async getTaskIdByOrderId(orderId) {
        try {
            const query = `
                SELECT task_id
                FROM task_orders
                WHERE order_id = ?
                LIMIT 1
            `;
            const rows = await db.query(query, [orderId]);
            return rows.length > 0 ? rows[0].task_id : null;
        } catch (error) {
            console.error('通过订单ID查找任务ID失败:', error);
            throw error;
        }
    }
}

module.exports = new TaskModel();

