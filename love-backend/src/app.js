const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

// 导入定时任务服务
const taskScheduler = require('./services/taskScheduler');

const app = express();

// 中间件配置 - 必须在路由之前
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务配置
app.use('/img', express.static(path.join(__dirname, 'uploads', 'img')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由配置
const authRoutes = require('./routes/auth');//  认证
const uploadRoutes = require('./routes/upload');  // 上传
const productRoutes = require('./routes/products'); // 商品
const cartRoutes = require('./routes/cart'); // 购物车
const orderRoutes = require('./routes/order'); // 订单
const pointsRoutes = require('./routes/points'); // 添加积分路由
const addressRoutes = require('./routes/address'); // 添加地址路由
const favoriteRoutes = require('./routes/favorites'); // 收藏
// 移除不存在的测试路由模块引用
const contactsRoutes = require('./routes/contacts'); // 联系人路由
const deepseekRoutes = require('./routes/deepseekRoutes'); // DeepSeek AI路由
const aiRoutes = require('./routes/aiRoutes'); // AI菜品推荐路由
const merchantRoutes = require('./routes/merchant'); // 商家相关路由
const notificationRoutes = require('./routes/notifications'); // 商家消息通知
const adminRoutes = require('./routes/admin'); // 管理员后台路由
const volunteerRoutes = require('./routes/volunteer'); // 志愿者相关路由
const taskRoutes = require('./routes/tasks'); // 志愿者任务路由
const elderlyInfoRoutes = require('./routes/elderlyInfo'); // 老人健康信息路由

// 图片测试页面路由
app.get('/test-image', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-image.html'));
});

// 测试路由 - 用于验证路由配置
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: '测试路由工作正常' });
});

// API路由
app.use('/api/auth', authRoutes);//   认证
app.use('/api/upload', uploadRoutes);//上传
app.use('/api/products', productRoutes);//商品
app.use('/api/cart', cartRoutes);//购物车
app.use('/api/order', orderRoutes);//订单
app.use('/api/points', pointsRoutes); // 积分相关API
app.use('/api/addresses', addressRoutes); // 地址相关API (直接指定完整路径)
app.use('/api/favorites', favoriteRoutes); // 收藏相关API
app.use('/api/contacts', contactsRoutes); // 联系人相关API
app.use('/api/deepseek', deepseekRoutes); // DeepSeek AI相关API
app.use('/api/ai', aiRoutes); // AI菜品推荐相关API
app.use('/api/merchant', merchantRoutes); // 商家相关API
app.use('/api/notifications', notificationRoutes); // 商家消息通知
app.use('/api/admin', adminRoutes); // 管理员后台接口
app.use('/api/volunteer', volunteerRoutes); // 志愿者相关API
app.use('/api/tasks', taskRoutes); // 志愿者任务API
app.use('/api/elderly-info', elderlyInfoRoutes); // 老人健康信息API


// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API运行正常',
    timestamp: new Date().toISOString()
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('发生错误:', err.message);
  console.error('错误堆栈:', err.stack);
  if (req.body) {
    console.error('请求体:', req.body);
  }
  res.status(err.status || 500).json({
    success: false,
    code: err.status || 500,
    message: err.message || '服务器内部错误',
    data: null,
    timestamp: new Date().toISOString()
  });
});

// 404处理 - 必须是最后一个中间件
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 启动定时任务服务
// 注意：只在生产环境或明确需要时启动
if (process.env.ENABLE_TASK_SCHEDULER !== 'false') {
  taskScheduler.start();
  console.log('定时任务服务已启动');
}

module.exports = app;