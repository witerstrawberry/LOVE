const db = require('../config/database');

class TaskVolunteerModel {
    constructor() {
        this.tableName = 'task_volunteer';
    }

    async getAssignmentsByVolunteer(volunteerId) {
        try {
            const query = `
                SELECT task_id, volunteer_id, status, service_hours, accept_time
                FROM ${this.tableName}
                WHERE volunteer_id = ?
            `;
            return await db.query(query, [volunteerId]);
        } catch (error) {
            console.error('获取志愿者任务关系失败:', error);
            throw error;
        }
    }

    async getStatsByVolunteer(volunteerId) {
        try {
            // 完成任务判断标准：只有当商家设置任务为"任务结束"（task.status = 3）时，才算志愿者完成任务
            const query = `
                SELECT 
                    COALESCE(SUM(tv.service_hours), 0) AS total_hours,
                    COUNT(*) AS total_tasks,
                    SUM(CASE WHEN t.status = 3 THEN 1 ELSE 0 END) AS completed_tasks
                FROM ${this.tableName} tv
                JOIN task t ON tv.task_id = t.task_id
                WHERE tv.volunteer_id = ?
            `;
            const rows = await db.query(query, [volunteerId]);
            return rows[0] || { total_hours: 0, total_tasks: 0, completed_tasks: 0 };
        } catch (error) {
            console.error('获取志愿者统计信息失败:', error);
            throw error;
        }
    }

    async claimTask(taskId, volunteerId, connection = null) {
        try {
            const query = `
                INSERT INTO ${this.tableName} (
                    task_id,
                    volunteer_id,
                    accept_time,
                    status
                ) VALUES (?, ?, NOW(), 1)
            `;
            if (connection) {
                await connection.execute(query, [taskId, volunteerId]);
            } else {
            await db.query(query, [taskId, volunteerId]);
            }
            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('您已认领过该任务');
            }
            console.error('认领任务失败:', error);
            throw error;
        }
    }

    async hasUserClaimedTask(taskId, volunteerId) {
        try {
            const query = `
                SELECT 1
                FROM ${this.tableName}
                WHERE task_id = ? AND volunteer_id = ? AND status IN (1, 2)
                LIMIT 1
            `;
            const rows = await db.query(query, [taskId, volunteerId]);
            return rows.length > 0;
        } catch (error) {
            console.error('检查用户任务关系失败:', error);
            throw error;
        }
    }

    async getTasksWithDetails(volunteerId) {
        try {
            const query = `
                SELECT 
                    tv.relation_id,
                    tv.task_id,
                    tv.volunteer_id,
                    tv.status AS volunteer_status,
                    tv.accept_time,
                    tv.service_hours,
                    t.task_title,
                    t.task_content,
                    t.task_type,
                    t.require_num,
                    t.start_time,
                    t.end_time,
                    t.address,
                    t.status AS task_status,
                    m.name AS merchant_name,
                    m.phone AS merchant_phone
                FROM ${this.tableName} tv
                JOIN task t ON tv.task_id = t.task_id
                LEFT JOIN merchants m ON t.merchant_id = m.id
                WHERE tv.volunteer_id = ?
                ORDER BY tv.accept_time DESC
            `;
            return await db.query(query, [volunteerId]);
        } catch (error) {
            console.error('获取志愿者任务列表失败:', error);
            throw error;
        }
    }

    /**
     * 判断指定用户是否具备查看/操作该订单的志愿者权限
     * 1）若订单已分配，需匹配 order_volunteer
     * 2）若订单未分配，允许已认领该任务的志愿者查看
     */
    async isVolunteerOfOrder(userId, orderId) {
        try {
            // 场景1：订单已经分配给具体志愿者
            const assignedQuery = `
                SELECT 1
                FROM users u
                JOIN volunteer v ON v.user_id = u.id
                JOIN order_volunteer ov ON ov.volunteer_id = v.volunteer_id
                WHERE u.id = ?
                  AND ov.order_id = ?
                LIMIT 1
            `;
            const assignedRows = await db.query(assignedQuery, [userId, orderId]);
            if (assignedRows.length > 0) {
                return true;
            }

            // 场景2：订单尚未分配，但志愿者已认领该订单所属任务
            const fallbackQuery = `
                SELECT 1
                FROM users u
                JOIN volunteer v ON v.user_id = u.id
                JOIN ${this.tableName} tv ON tv.volunteer_id = v.volunteer_id
                JOIN task_orders to_rel ON to_rel.task_id = tv.task_id
                WHERE u.id = ?
                  AND to_rel.order_id = ?
                  AND tv.status IN (1, 2)
                LIMIT 1
            `;
            const fallbackRows = await db.query(fallbackQuery, [userId, orderId]);
            return fallbackRows.length > 0;
        } catch (error) {
            console.error('判断用户是否为订单志愿者失败:', error);
            throw error;
        }
    }

    /**
     * 检查订单是否已经被分配给某个志愿者
     * 注意：一个任务下的多个订单可以由不同的志愿者接取
     * @param {number} orderId 订单ID
     * @returns {boolean} 订单是否已被分配
     */
    async hasVolunteerForOrder(orderId) {
        try {
            const query = `
                SELECT 1
                FROM order_volunteer
                WHERE order_id = ?
                LIMIT 1
            `;
            const rows = await db.query(query, [orderId]);
            return rows.length > 0;
        } catch (error) {
            console.error('检查订单是否有志愿者接单失败:', error);
            throw error;
        }
    }

    async unclaimTask(taskId, volunteerId, connection = null) {
        try {
            const executor = connection ? connection.execute.bind(connection) : db.execute.bind(db);
            const [result] = await executor(
                `DELETE FROM ${this.tableName} WHERE task_id = ? AND volunteer_id = ?`,
                [taskId, volunteerId]
            );
            if (result.affectedRows === 0) {
                throw new Error('未找到可取消的认领记录');
            }
            return true;
        } catch (error) {
            console.error('取消志愿者认领失败:', error);
            throw error;
        }
    }

    /**
     * 当任务标记为完成后，根据任务的实际时间（end_time - start_time）更新所有认领该任务的志愿者的service_hours
     * @param {number} taskId 任务ID
     * @param {object} connection 数据库连接（可选，用于事务）
     * @returns {Promise<number>} 更新的志愿者数量
     */
    async updateServiceHoursOnTaskComplete(taskId, connection = null) {
        try {
            const executor = connection ? connection.execute.bind(connection) : db.execute.bind(db);
            
            // 首先获取任务的时间信息
            const [taskRows] = await executor(
                `SELECT start_time, end_time FROM task WHERE task_id = ?`,
                [taskId]
            );

            if (taskRows.length === 0) {
                console.warn(`任务 ${taskId} 不存在，无法更新服务时长`);
                return 0;
            }

            const task = taskRows[0];
            if (!task.start_time || !task.end_time) {
                console.warn(`任务 ${taskId} 缺少开始时间或结束时间，无法计算服务时长`);
                return 0;
            }

            // 计算任务时长（小时）
            const startTime = new Date(task.start_time);
            const endTime = new Date(task.end_time);
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationHours = durationMs / (1000 * 60 * 60); // 转换为小时

            if (durationHours <= 0) {
                console.warn(`任务 ${taskId} 的时长计算为0或负数: ${durationHours} 小时`);
                return 0;
            }

            console.log(`任务 ${taskId} 的时长为: ${durationHours.toFixed(2)} 小时`);

            // 获取所有认领该任务的志愿者及其当前的service_hours
            const [volunteerTasks] = await executor(
                `SELECT volunteer_id, service_hours 
                 FROM ${this.tableName} 
                 WHERE task_id = ?`,
                [taskId]
            );

            if (volunteerTasks.length === 0) {
                console.log(`任务 ${taskId} 没有志愿者认领，无需更新服务时长`);
                return 0;
            }

            let updatedCount = 0;
            
            // 对每个志愿者-任务关系进行处理
            for (const vt of volunteerTasks) {
                const currentServiceHours = vt.service_hours || 0;
                
                // 如果service_hours已经有值（不为NULL且不为0），说明这个任务已经计算过，跳过
                if (currentServiceHours > 0) {
                    console.log(`任务 ${taskId} 的志愿者 ${vt.volunteer_id} 的服务时长已经计算过 (${currentServiceHours} 小时)，跳过`);
                    continue;
                }
                
                // 如果service_hours为NULL或0，说明还没有计算过，进行累加计算
                // 在原有基础上累加（虽然当前是0，但保持逻辑一致性）
                const newServiceHours = currentServiceHours + durationHours;
                
                await executor(
                    `UPDATE ${this.tableName} 
                     SET service_hours = ? 
                     WHERE task_id = ? 
                     AND volunteer_id = ?`,
                    [newServiceHours, taskId, vt.volunteer_id]
                );
                
                updatedCount++;
                console.log(`更新志愿者 ${vt.volunteer_id} 的任务 ${taskId} 服务时长: ${currentServiceHours} + ${durationHours.toFixed(2)} = ${newServiceHours.toFixed(2)} 小时`);
            }

            console.log(`成功更新 ${updatedCount} 个志愿者的服务时长，任务ID: ${taskId}`);
            return updatedCount;
        } catch (error) {
            console.error('更新志愿者服务时长失败:', error);
            throw error;
        }
    }
}

module.exports = new TaskVolunteerModel();

