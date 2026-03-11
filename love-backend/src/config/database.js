// 导入mysql模块
const mysql = require('mysql2/promise');


const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'love',
  password: process.env.DB_PASSWORD || '148639@Zxc',
  database: process.env.DB_NAME || 'love',
  charset: 'utf8mb4',
  timezone: '+08:00'
};

// 连接池配置
const poolConfig = {
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 10,
  idleTimeout: 60000
};

// 创建连接池
const pool = mysql.createPool(poolConfig);

// 连接池错误事件监听
pool.on('error', (err) => {
  console.error('连接池错误:', err);
});

// 测试数据库连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error.message);
    return false;
  }
}

// 执行查询
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

// 执行原始查询（直接使用query方法，不使用预处理语句）
async function rawQuery(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('数据库原始查询错误:', error);
    throw error;
  }
}

// 执行事务
async function transaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  getConnection: pool.getConnection.bind(pool), // 添加 getConnection 方法
  execute: pool.execute.bind(pool), // 添加 execute 方法
  query,
  rawQuery,
  transaction,
  testConnection
};
