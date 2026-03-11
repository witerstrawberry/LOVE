/**
 * 定时任务服务
 * 1. 每天凌晨4点自动生成当天的配送任务
 * 2. 每天凌晨1点自动将前一天的任务状态改为已完成
 */

const cron = require('node-cron');
const Task = require('../models/Task');
const Merchant = require('../models/Merchant');
const db = require('../config/database');

class TaskScheduler {
    constructor() {
        this.isRunning = false;
    }

    /**
     * 启动定时任务
     */
    start() {
        if (this.isRunning) {
            console.log('定时任务已经在运行中');
            return;
        }

        // 每天凌晨1点执行：将前一天的任务状态改为已完成
        cron.schedule('0 1 * * *', async () => {
            console.log('开始执行定时任务：将前一天的任务状态改为已完成');
            try {
                await this.completePreviousDayTasks();
                console.log('定时任务执行完成：已更新前一天的任务状态');
            } catch (error) {
                console.error('更新前一天任务状态失败:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Shanghai"
        });

        // 每天凌晨4点执行：生成当天的配送任务
        cron.schedule('0 4 * * *', async () => {
            console.log('开始执行定时任务：生成当天的配送任务');
            try {
                await this.generateTodayTasks();
                console.log('定时任务执行完成：已生成当天的配送任务');
            } catch (error) {
                console.error('定时任务执行失败:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Shanghai"
        });

        this.isRunning = true;
        console.log('定时任务已启动：');
        console.log('  - 每天凌晨1点：将前一天的任务状态改为已完成');
        console.log('  - 每天凌晨4点：生成当天的配送任务');
    }

    /**
     * 停止定时任务
     */
    stop() {
        this.isRunning = false;
        console.log('定时任务已停止');
    }

    /**
     * 将前一天的任务状态改为已完成（status = 3）
     */
    async completePreviousDayTasks() {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 获取前一天的日期（YYYYMMDD格式）
            const [dateRows] = await connection.execute(
                `SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '%Y%m%d') as yesterday_date,
                        DATE_SUB(CURDATE(), INTERVAL 1 DAY) as yesterday_date_full`
            );
            const yesterdayDateStr = dateRows[0]?.yesterday_date || 
                new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '');
            const yesterdayDateFull = dateRows[0]?.yesterday_date_full || 
                new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const taskTitle = `auto${yesterdayDateStr}`; // auto20241112
            
            console.log(`准备更新前一天的任务状态，日期：${yesterdayDateFull}，任务标题：${taskTitle}`);
            
            // 查找前一天的所有自动生成的任务（状态为1或2的任务）
            const [tasks] = await connection.execute(
                `SELECT task_id, merchant_id, task_title, status 
                 FROM task 
                 WHERE task_title = ? 
                 AND status IN (1, 2)`,
                [taskTitle]
            );

            console.log(`找到 ${tasks.length} 个前一天的任务需要更新状态`);

            if (tasks.length === 0) {
                console.log('没有找到需要更新的任务');
                await connection.commit();
                return;
            }

            // 更新这些任务的状态为已完成（status = 3）
            const [updateResult] = await connection.execute(
                `UPDATE task 
                 SET status = 3, updated_at = NOW() 
                 WHERE task_title = ? 
                 AND status IN (1, 2)`,
                [taskTitle]
            );

            // 更新所有认领这些任务的志愿者的服务时长
            if (updateResult.affectedRows > 0) {
                console.log(`开始更新 ${updateResult.affectedRows} 个任务的志愿者服务时长`);
                const TaskVolunteer = require('../models/TaskVolunteer');
                
                // 获取所有被更新的任务ID
                const [updatedTasks] = await connection.execute(
                    `SELECT task_id FROM task 
                     WHERE task_title = ? 
                     AND status = 3`,
                    [taskTitle]
                );

                let totalUpdatedVolunteers = 0;
                for (const task of updatedTasks) {
                    try {
                        const updatedCount = await TaskVolunteer.updateServiceHoursOnTaskComplete(
                            task.task_id, 
                            connection
                        );
                        totalUpdatedVolunteers += updatedCount;
                    } catch (error) {
                        console.error(`更新任务 ${task.task_id} 的志愿者服务时长失败:`, error);
                        // 继续处理其他任务，不中断整个流程
                    }
                }
                console.log(`成功更新 ${totalUpdatedVolunteers} 个志愿者的服务时长`);
            }

            await connection.commit();
            console.log(`成功更新 ${updateResult.affectedRows} 个前一天的任务状态为已完成`);

        } catch (error) {
            await connection.rollback();
            console.error('更新前一天任务状态失败:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 生成当天的配送任务
     */
    async generateTodayTasks() {
        const connection = await db.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 获取今天的日期，使用数据库的日期函数确保时区一致
            const [dateRows] = await connection.execute(
                `SELECT DATE_FORMAT(CURDATE(), '%Y%m%d') as today_date,
                        CURDATE() as today_date_full,
                        DATE_FORMAT(CURDATE(), '%Y年%m月%d日') as today_date_formatted`
            );
            const todayDateStr = dateRows[0]?.today_date || 
                new Date().toISOString().split('T')[0].replace(/-/g, '');
            const todayDateFull = dateRows[0]?.today_date_full || 
                new Date().toISOString().split('T')[0];
            const todayDateFormatted = dateRows[0]?.today_date_formatted || 
                (() => {
                    const d = new Date();
                    return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
                })();
            const taskTitle = `auto${todayDateStr}`; // auto20241113
            
            console.log(`准备生成今天的任务，日期：${todayDateFull}，任务标题：${taskTitle}`);
            
            // 获取所有商家
            const [merchants] = await connection.execute(
                `SELECT id, name, address, phone, contact_person 
                 FROM merchants 
                 WHERE id IS NOT NULL`
            );

            console.log(`找到 ${merchants.length} 个商家，开始生成任务`);

            let successCount = 0;
            let skipCount = 0;

            for (const merchant of merchants) {
                try {
                    // 检查该商家是否已经存在今天的任务
                    const [existingTasks] = await connection.execute(
                        `SELECT task_id FROM task 
                         WHERE merchant_id = ? 
                         AND task_title = ? 
                         LIMIT 1`,
                        [merchant.id, taskTitle]
                    );

                    if (existingTasks.length > 0) {
                        console.log(`商家 ${merchant.id} 的今天任务已存在，跳过`);
                        skipCount++;
                        continue;
                    }

                    // 生成任务开始和结束时间（今天6:00-20:00）
                    // 使用数据库日期函数确保时区一致
                    const [timeRows] = await connection.execute(
                        `SELECT 
                            CONCAT(CURDATE(), ' 06:00:00') as start_time,
                            CONCAT(CURDATE(), ' 20:00:00') as end_time`
                    );
                    const startTime = timeRows[0]?.start_time || 
                        `${todayDateFull} 06:00:00`;
                    const endTime = timeRows[0]?.end_time || 
                        `${todayDateFull} 20:00:00`;

                    // 创建任务
                    const taskData = {
                        merchant_id: merchant.id,
                        contact_name: merchant.contact_person || merchant.name || '商家',
                        contact_phone: merchant.phone || '',
                        task_title: taskTitle,
                        task_content: `配送任务：${todayDateFormatted} 的订单配送任务（6:00-20:00）`,
                        task_type: '配送',
                        require_num: 3, 
                        start_time: startTime,
                        end_time: endTime,
                        address: merchant.address || '商家地址',
                        delivery_fee: 0.00,
                        max_delivery_distance: 5.00,
                        delivery_deadline: null,
                        order_count: 0,
                        status: 1 // 待接取
                    };

                    // 直接使用connection执行插入，以便在事务中
                    const [taskResult] = await connection.execute(
                        `INSERT INTO task (
                            merchant_id, contact_name, contact_phone, task_title, task_content,
                            task_type, require_num, start_time, end_time, address,
                            delivery_fee, max_delivery_distance, delivery_deadline, order_count, status
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            taskData.merchant_id,
                            taskData.contact_name,
                            taskData.contact_phone,
                            taskData.task_title,
                            taskData.task_content,
                            taskData.task_type,
                            taskData.require_num,
                            taskData.start_time,
                            taskData.end_time,
                            taskData.address,
                            taskData.delivery_fee,
                            taskData.max_delivery_distance,
                            taskData.delivery_deadline,
                            taskData.order_count,
                            taskData.status
                        ]
                    );
                    
                    const taskId = taskResult.insertId;
                    
                    // 创建任务接单限制记录
                    await connection.execute(
                        `INSERT INTO task_accept_limit (task_id, require_num, current_accept_num)
                         VALUES (?, ?, ?)`,
                        [taskId, 3, 0]
                    );

                    console.log(`成功为商家 ${merchant.id} 创建任务 ${taskId}，日期：${todayDateStr}`);
                    successCount++;

                } catch (merchantError) {
                    console.error(`为商家 ${merchant.id} 创建任务失败:`, merchantError);
                    // 继续处理下一个商家
                }
            }

            await connection.commit();
            console.log(`任务生成完成：成功 ${successCount} 个，跳过 ${skipCount} 个`);

        } catch (error) {
            await connection.rollback();
            console.error('生成配送任务失败:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 生成第二天的配送任务（已弃用，保留用于兼容）
     * @deprecated 请使用 generateTodayTasks
     */
    async generateNextDayTasks() {
        console.log('警告：generateNextDayTasks 已弃用，请使用 generateTodayTasks');
        await this.generateTodayTasks();
    }

    /**
     * 手动触发生成任务（用于测试）
     */
    async generateTasksManually() {
        console.log('手动触发生成任务');
        await this.generateTodayTasks();
    }

    /**
     * 手动触发完成前一天任务（用于测试）
     */
    async completePreviousDayTasksManually() {
        console.log('手动触发完成前一天任务');
        await this.completePreviousDayTasks();
    }
}

module.exports = new TaskScheduler();

