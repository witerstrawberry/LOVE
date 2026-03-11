const db = require('../config/database');

class TaskAcceptLimit {
    static async getByTaskId(taskId, options = {}) {
        const { connection = null, forUpdate = false } = options;
        const executor = connection ? connection.execute.bind(connection) : db.execute.bind(db);
        const query = `
            SELECT task_id, current_accept_num, require_num
            FROM task_accept_limit
            WHERE task_id = ?
            ${forUpdate ? 'FOR UPDATE' : ''}
        `;
        const [rows] = await executor(query, [taskId]);
        return rows[0] || null;
    }

    static async increment(taskId, connection) {
        await connection.execute(
            'UPDATE task_accept_limit SET current_accept_num = current_accept_num + 1 WHERE task_id = ?',
            [taskId]
        );
    }

    static async decrement(taskId, connection) {
        await connection.execute(
            'UPDATE task_accept_limit SET current_accept_num = GREATEST(current_accept_num - 1, 0) WHERE task_id = ?',
            [taskId]
        );
    }
}

module.exports = TaskAcceptLimit;

