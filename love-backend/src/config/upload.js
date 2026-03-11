const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名：时间戳 + 随机数 + 固定.jpg扩展名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + '.jpg');
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

// 头像上传接口
router.post('/avatar', upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的图片'
      });
    }

    // 构建文件访问URL - 使用完整的服务器地址
    const fileUrl = `http://localhost:3000/uploads/avatars/${req.file.filename}`;
    
    console.log('头像上传成功:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      url: fileUrl
    });

    res.json({
      success: true,
      message: '头像上传成功',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error('头像上传错误:', error);
    res.status(500).json({
      success: false,
      error: '头像上传失败'
    });
  }
});

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '文件大小不能超过5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '只能上传一个文件'
      });
    }
  }
  
  res.status(400).json({
    success: false,
    error: error.message || '上传失败'
  });
});

module.exports = router;