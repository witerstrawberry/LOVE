const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');


router.post('/register', authController.register);


router.post('/login', authController.login);


router.post('/logout', authenticateToken, authController.logout);


router.get('/profile', authenticateToken, authController.getProfile);


router.put('/profile', authenticateToken, authController.updateProfile);


router.put('/password', authenticateToken, authController.changePassword);


router.post('/check-phone', authController.checkPhone);

module.exports = router;