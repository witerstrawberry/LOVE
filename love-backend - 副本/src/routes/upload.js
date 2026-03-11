const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/avatars');
const volunteerUploadDir = path.join(__dirname, '../uploads/volunteer');
const merchantUploadDir = path.join(__dirname, '../uploads/merchants');
const restaurantSceneImageDir = path.join(__dirname, '../uploads/merchants/restaurant_scene_image');
const businessLicenseImageDir = path.join(__dirname, '../uploads/merchants/business_license_image');
const logoDir = path.join(__dirname, '../uploads/merchants/logos');
const productImageDir = path.join(__dirname, '../uploads/img');

const directories = [uploadDir, volunteerUploadDir, merchantUploadDir, restaurantSceneImageDir, businessLicenseImageDir, logoDir, productImageDir];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 根据文件类型和用户类型选择存储目录
    const uploadType = req.body.type;
    const userType = req.body.user_type || req.body.role || '';
    let targetDir = merchantUploadDir;
    
    console.log('上传参数:', { uploadType, userType, fieldname: file.fieldname });
    
    // 优先处理头像上传
    if (uploadType === 'avatar' || file.fieldname === 'avatar') {
      // 根据用户类型决定存储目录
      if (userType === 'volunteer' || req.body.is_volunteer === 'true') {
        targetDir = volunteerUploadDir;
      } else {
        targetDir = uploadDir;
      }
    } else {
      // 其他类型文件的处理
      switch(uploadType) {
        case 'logo':
          targetDir = logoDir;
          break;
        case 'product':
          targetDir = productImageDir;
          break;
        case 'license':
          targetDir = businessLicenseImageDir;
          break;
        case 'restaurant':
          targetDir = restaurantSceneImageDir;
          break;
        default:
          targetDir = merchantUploadDir;
      }
    }
    
    console.log('文件存储目录:', targetDir, '类型:', uploadType, '用户类型:', userType);
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名：时间戳 + 随机数 + 原扩展名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const uploadType = req.body.type;
    const userType = req.body.user_type || req.body.role || '';
    
    // 对于头像，根据用户类型使用不同前缀
    if (uploadType === 'avatar' || file.fieldname === 'avatar') {
      if (userType === 'volunteer' || req.body.is_volunteer === 'true') {
        cb(null, 'volunteer-' + uniqueSuffix + '.jpg');
      } else {
        cb(null, 'avatar-' + uniqueSuffix + '.jpg');
      }
    } else {
      const ext = path.extname(file.originalname);
      cb(null, uploadType + '-' + uniqueSuffix + ext);
    }
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 只允许图片文件
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'), false);
  }
};

// 配置multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 限制5MB
    files: 1 // 只允许上传一个文件
  }
});

// 错误处理中间件必须在路由定义之前
router.use((err, req, res, next) => {
  console.error('Multer 错误:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '文件大小不能超过5MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '只能上传一个文件'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: '不支持的文件字段名'
      });
    }
  }
  
  res.status(400).json({
    success: false,
    error: err.message || '上传失败'
  });
});

// 通用文件上传接口（支持商家图片上传）
router.post('/', (req, res, next) => {
  console.log('开始处理上传请求...');
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer 中间件错误:', err);
      return next(err);
    }
    
    next();
  });
}, (req, res) => {
  try {
    console.log('=== 开始处理文件上传 ===');
    console.log('req.file 存在:', !!req.file);
    console.log('req.body:', req.body);
    console.log('req.body.type:', req.body?.type);
    
    if (!req.file) {
      console.log('❌ 没有收到文件');
      return res.status(400).json({
        success: false,
        error: '请选择要上传的图片'
      });
    }

    // 获取上传类型参数
    const uploadType = req.body.type || 'general';
    let uploadDir = merchantUploadDir;
    let urlPath = 'merchants';

    // 根据类型选择存储目录和URL路径
    switch(uploadType) {
      case 'logo':
        uploadDir = logoDir;
        urlPath = 'merchants/logos';
        break;
      case 'product':
        uploadDir = productImageDir;
        urlPath = 'img';
        break;
      case 'license':
        uploadDir = businessLicenseImageDir;
        urlPath = 'merchants/business_license_image';
        break;
      case 'restaurant':
        uploadDir = restaurantSceneImageDir;
        urlPath = 'merchants/restaurant_scene_image';
        break;
      default:
        uploadDir = merchantUploadDir;
        urlPath = 'merchants';
    }

    console.log('📁 存储目录:', uploadDir);
    console.log('🔗 URL路径:', urlPath);

    // 构建文件访问URL - 使用完整的服务器地址
    const fileUrl = `http://localhost:3000/uploads/${urlPath}/${req.file.filename}`;
    
    console.log('✅ 文件上传成功:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      uploadType: uploadType,
      url: fileUrl
    });

    const response = {
      success: true,
      message: '文件上传成功',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size,
        type: uploadType
      }
    };
    
    console.log('📤 返回响应:', response);
    res.json(response);

  } catch (error) {
    console.error('❌ 文件上传错误:', error);
    res.status(500).json({
      success: false,
      error: '文件上传失败: ' + error.message
    });
  }
});

// 头像上传接口
router.post('/avatar', (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      console.error('Multer 头像上传错误:', err);
      return next(err);
    }
    
    next();
  });
}, (req, res) => {
  try {
    console.log('=== 开始处理头像上传 ===');
    console.log('req.file 存在:', !!req.file);
    console.log('req.body:', req.body);
    
    if (!req.file) {
      console.log('❌ 没有收到头像文件');
      return res.status(400).json({
        success: false,
        error: '请选择要上传的图片'
      });
    }

    // 根据文件存储路径确定URL前缀
    let urlPrefix = '/uploads/avatars';
    if (req.file.destination.includes('volunteer')) {
      urlPrefix = '/uploads/volunteer';
    }
    
    // 构建文件访问URL - 使用完整的服务器地址
    const fileUrl = `http://localhost:3000${urlPrefix}/${req.file.filename}`;
    
    console.log('✅ 头像上传成功:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      destination: req.file.destination,
      url: fileUrl
    });

    const response = {
      success: true,
      message: '头像上传成功',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size
      }
    };
    
    console.log('📤 返回响应:', response);
    res.json(response);

  } catch (error) {
    console.error('❌ 头像上传错误:', error);
    res.status(500).json({
      success: false,
      error: '头像上传失败: ' + error.message
    });
  }
});

module.exports = router;