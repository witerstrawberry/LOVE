const app = require('./src/app');
const { testConnection } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

// 测试数据库连接
async function startServer() {
  try {
    console.log('正在测试数据库连接...');
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('数据库连接失败，服务器无法启动');
      process.exit(1);
    }
    
    console.log('数据库连接成功，正在启动服务器...');
    const server = app.listen(PORT, () => {
      console.log(`后端API服务器运行在端口 ${PORT}`);
      console.log(`API文档地址: http://localhost:${PORT}/api-docs`);
    });
    
    // 监听服务器错误
    server.on('error', (err) => {
      console.error('服务器错误:', err);
      process.exit(1);
    });
    
    // 监听未捕获的异常
    process.on('uncaughtException', (err) => {
      console.error('未捕获的异常:', err);
      process.exit(1);
    });
    
    // 监听未处理的Promise拒绝
    process.on('unhandledRejection', (err) => {
      console.error('未处理的Promise拒绝:', err);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();