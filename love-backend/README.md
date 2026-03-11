# 后端API

## 项目概述

这是一个基于Node.js + Express + MySQL的后端API系统，为微信小程序提供数据支持。

## 技术栈

- **运行环境**: Node.js 16+
- **Web框架**: Express.js
- **数据库**: MySQL 8.0+
- **身份认证**: JWT
- **密码加密**: bcryptjs
- **跨域处理**: CORS
- **环境配置**: dotenv

## 项目结构

```
wedding-backend/
├── server.js                 # 服务器启动文件
├── package.json              # 项目依赖配置
├── .env.example              # 环境变量示例
├── README.md                 # 项目说明
├── database/
│   └── schema.sql            # 数据库表结构
├── src/
│   ├── app.js                # Express应用配置
│   ├── config/
│   │   └── database.js       # 数据库配置
│   ├── middleware/
│   │   └── auth.js           # JWT认证中间件
│   ├── routes/               # 路由文件夹
│   │   ├── auth.js           # 认证相关路由
│   │   ├── user.js           # 用户相关路由
│   │   ├── category.js       # 分类相关路由
│   │   ├── goods.js          # 商品相关路由
│   │   ├── order.js          # 订单相关路由
│   │   ├── coupon.js         # 优惠券相关路由
│   │   ├── member.js         # 会员相关路由
│   │   ├── news.js           # 新闻相关路由
│   │   └── merchant.js       # 商家相关路由
│   ├── controllers/          # 控制器文件夹
│   ├── models/               # 数据模型文件夹
│   ├── services/             # 业务逻辑文件夹
│   └── utils/                # 工具函数
│       ├── response.js       # 统一响应格式
│       └── validation.js     # 数据验证工具
└── uploads/                  # 文件上传目录
```

## 主要功能模块

### 1. 用户认证模块
- 微信小程序登录
- JWT token管理
- 用户信息管理

### 2. 商品管理模块
- 商品分类管理
- 商品信息管理
- 商品搜索功能
- 秒杀商品管理

### 3. 订单管理模块
- 订单创建
- 订单状态管理
- 订单查询

### 4. 会员系统模块
- 会员等级管理
- 积分系统
- 会员权益

### 5. 优惠券模块
- 优惠券发放
- 优惠券使用
- 优惠券管理

### 6. 内容管理模块
- 新闻资讯
- 轮播图管理
- 商家信息

## 数据库设计

### 核心表结构
- `users` - 用户表
- `members` - 会员表
- `categories` - 商品分类表
- `goods` - 商品表
- `orders` - 订单表
- `order_items` - 订单商品表
- `coupons` - 优惠券表
- `user_coupons` - 用户优惠券表
- `news` - 新闻资讯表
- `merchants` - 商家表
- `banners` - 轮播图表
- `system_configs` - 系统配置表

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

### 3. 创建数据库
```bash
# 在MySQL中执行 database/schema.sql 文件
mysql -u root -p < database/schema.sql
```

### 4. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API接口规范

### 统一响应格式
```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 分页响应格式
```json
{
  "success": true,
  "code": 200,
  "message": "获取成功",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 开发规范

### 1. 代码规范
- 使用ES6+语法
- 统一使用async/await处理异步
- 遵循RESTful API设计原则

### 2. 错误处理
- 统一错误响应格式
- 详细的错误日志记录
- 合适的HTTP状态码

### 3. 安全规范
- JWT token认证
- 密码加密存储
- SQL注入防护
- XSS攻击防护

## 部署说明

### 环境要求
- Node.js 16+
- MySQL 8.0+
- PM2 (生产环境推荐)

### 生产部署
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name wedding-backend

# 查看状态
pm2 status

# 查看日志
pm2 logs wedding-backend
```

## 联系方式

如有问题，请联系开发团队。