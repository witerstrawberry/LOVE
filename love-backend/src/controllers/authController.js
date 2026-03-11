const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserPoints = require('../models/UserPoints'); // 添加UserPoints模型
const { success, error, badRequest, unauthorized, conflict } = require('../utils/response');
const { isValidPhone: validatePhone, isValidPassword: validatePassword, sanitizeString } = require('../utils/validation');

// 简单的必填字段验证函数
function validateRequired(value) {
    return value !== undefined && value !== null && value.toString().trim() !== '';
}

class AuthController {
    /**
     * 用户注册
     */
    async register(req, res) {
        try {
            console.log('===== 注册请求开始 =====');
            console.log('请求体所有字段:', JSON.stringify(req.body));
            
            const { phone, password, nickname, gender, city, avatar, role_id } = req.body;
            
            // 记录所有收到的字段
            console.log('请求字段详情 - phone:', phone);
            console.log('请求字段详情 - password:', password ? '已提供' : '未提供');
            console.log('请求字段详情 - nickname:', nickname);
            console.log('请求字段详情 - gender:', gender);
            console.log('请求字段详情 - city:', city);
            console.log('请求字段详情 - avatar:', avatar);
            console.log('请求字段详情 - role_id:', role_id);

            // 验证必填字段
            if (!phone || !password || phone.trim() === '' || password.trim() === '') {
                console.log('❌ 参数验证失败: 手机号或密码为空');
                console.log('详细参数验证结果 - phone:', phone, 'password存在:', !!password);
                return badRequest(res, '手机号和密码不能为空');
            }

            // 验证手机号格式
            if (!validatePhone(phone)) {
                console.log('❌ 手机号格式验证失败:', phone);
                console.log('手机号格式验证函数返回:', validatePhone(phone));
                return badRequest(res, '手机号格式不正确');
            }

            // 验证密码强度
            if (!validatePassword(password)) {
                console.log('❌ 密码格式验证失败');
                console.log('密码长度:', password ? password.length : '无密码');
                console.log('密码验证函数返回:', validatePassword(password));
                return badRequest(res, '密码长度必须在6-20位之间');
            }

            // 检查手机号是否已存在
            console.log('检查手机号是否已存在:', phone);
            try {
                const existingUser = await User.findByPhone(phone);
                if (existingUser) {
                    console.log('手机号已存在:', phone);
                    return conflict(res, '该手机号已被注册');
                }
            } catch (dbError) {
                console.error('数据库查询手机号失败:', dbError);
                console.error('数据库错误详情:', dbError.message);
                return error(res, '数据库操作失败，请稍后重试');
            }

            // 加密密码
            console.log('开始加密密码');
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            console.log('密码加密完成，哈希值长度:', hashedPassword.length);
            
            // 验证role_id是否有效
            console.log('role_id值:', role_id, '类型:', typeof role_id);
            let roleId = role_id;
            if (role_id === undefined || role_id === null || role_id === '') {
                console.log('未提供role_id，将使用默认值');
                roleId = null;
            } else {
                // 确保role_id是数字类型
                roleId = parseInt(role_id);
                if (isNaN(roleId)) {
                    console.log('role_id不是有效数字，将使用null');
                    roleId = null;
                }
            }

            // 创建用户数据
            const userData = {
                phone,
                password: hashedPassword,
                nickname: nickname ? sanitizeString(nickname) : null,
                gender: gender || 0,
                city: city ? sanitizeString(city) : null,
                avatar: avatar ? sanitizeString(avatar) : null,
                role_id: roleId
            };
            
            console.log('最终用户数据对象:', JSON.stringify(userData, null, 2));
            
            // 验证userData格式
            console.log('=== 数据类型验证 ===');
            console.log('phone类型:', typeof phone, '值:', phone);
            console.log('password类型:', typeof hashedPassword, '长度:', hashedPassword.length);
            console.log('nickname类型:', typeof userData.nickname, '值:', userData.nickname);
            console.log('gender类型:', typeof userData.gender, '值:', userData.gender);
            console.log('city类型:', typeof userData.city, '值:', userData.city);
            console.log('avatar类型:', typeof userData.avatar, '值:', userData.avatar);
            console.log('role_id类型:', typeof userData.role_id, '值:', userData.role_id);

            // 创建用户
            let newUser = null;
            try {
                console.log('开始调用User.create创建用户');
                newUser = await User.create(userData);
                console.log('用户创建成功，返回的用户对象:', newUser);
                if (!newUser || !newUser.id) {
                    console.error('创建用户返回的对象无效，缺少id字段');
                    throw new Error('创建用户返回的对象无效');
                }
            } catch (createError) {
                console.error('❌ 创建用户失败:', createError);
                console.error('错误详情:', createError.message);
                console.error('错误堆栈:', createError.stack);
                if (createError.sql) {
                    console.error('SQL语句:', createError.sql);
                }
                return error(res, '创建用户失败，请稍后重试');
            }
            
            // 生成JWT令牌
            console.log('开始生成JWT令牌');
            const token = jwt.sign(
                { userId: newUser.id, phone: newUser.phone },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );
            console.log('JWT令牌生成成功');

            // 记录登录会话
            try {
                console.log('开始创建用户会话');
                // 检查User是否有createSession方法
                if (typeof User.createSession === 'function') {
                    await User.createSession(newUser.id, token, req.headers['user-agent'] || 'unknown', req.ip || 'unknown');
                    console.log('用户会话创建成功');
                } else {
                    console.log('User.createSession方法不存在，跳过会话创建');
                }
            } catch (sessionError) {
                console.error('创建用户会话失败:', sessionError);
                // 会话创建失败不影响注册成功
            }

            // 返回用户信息
            console.log('准备返回用户信息');
            const { password: _, ...userInfo } = newUser;
            
            console.log('注册成功，返回数据:', {
                token: '***token***', // 不打印完整token
                user: userInfo
            });
            return success(res, {
                token,
                user: userInfo
            }, '注册成功');

        } catch (err) {
            console.error('===== 注册过程发生未捕获异常 =====');
            console.error('❌ 异常名称:', err.name);
            console.error('❌ 异常消息:', err.message);
            console.error('❌ 异常堆栈:', err.stack);
            if (err.code) console.error('❌ 错误代码:', err.code);
            if (err.sql) console.error('❌ SQL语句:', err.sql);
            console.error('❌ 失败时的请求体:', JSON.stringify(req.body));
            return error(res, '注册失败，请稍后重试');
        } finally {
            console.log('===== 注册请求结束 =====');
        }
    }

    /**
     * 用户登录
     */
    async login(req, res) {
        try {
            console.log('=== 登录请求开始 ===');
            console.log('请求体:', req.body);
            
            const { phone, password } = req.body;

            // 验证必填字段
            if (!phone || !password || phone.trim() === '' || password.trim() === '') {
                console.log('❌ 参数验证失败: 手机号或密码为空');
                return badRequest(res, '手机号和密码不能为空');
            }

            // 验证手机号格式
            if (!validatePhone(phone)) {
                console.log('❌ 手机号格式验证失败:', phone);
                return badRequest(res, '手机号格式不正确');
            }


            // 查找用户
            const user = await User.findByPhone(phone);
            console.log('数据库查询结果:', user ? '找到用户' : '用户不存在');
            
            if (!user) {
                console.log('❌ 用户不存在:', phone);
                return unauthorized(res, '手机号或密码错误');
            }

            // 检查用户状态
            console.log('用户状态:', user.status);
            if (user.status !== 'active') {
                console.log('❌ 用户状态异常:', user.status);
                return unauthorized(res, '账户已被禁用，请联系客服');
            }

            // 验证密码（支持直接指定管理员明文密码）
            console.log('开始验证密码...');
            let isPasswordValid = false;

            // 如果是预置的管理员账号，允许使用固定明文密码登录（用于简化测试/演示）
            if (phone === '18713203723' && password === '134987') {
                console.log('检测到预置管理员账号，使用固定明文密码校验通过');
                isPasswordValid = true;
            } else {
                isPasswordValid = await bcrypt.compare(password, user.password);
            }

            console.log('密码验证结果:', isPasswordValid);
            
            if (!isPasswordValid) {
                console.log('❌ 密码验证失败');
                return unauthorized(res, '手机号或密码错误');
            }

    

            // 生成JWT令牌
            const token = jwt.sign(
                { userId: user.id, phone: user.phone },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            // 更新最后登录时间
            await User.updateLastLogin(user.id);

            // 记录登录会话（可选）
            await User.createSession(user.id, token, req.headers['user-agent'], req.ip);

            // 返回用户信息（不包含密码）
            const { password: _, avatar_url, ...userInfo } = user;
            
            // 确保返回的用户信息中包含所有前端需要的字段，特别是处理avatar字段
            const formattedUserInfo = {
                ...userInfo,
                avatar: avatar_url, // 将数据库中的avatar_url映射为前端期望的avatar字段
                nickname: user.nickname || '', // 确保昵称字段始终存在
                city: user.city || '' // 确保城市字段始终存在
            };

            console.log('✅ 登录成功，返回用户信息');
            console.log('=== 登录请求结束 ===');

            return success(res, {
                token,
                user: formattedUserInfo
            }, '登录成功');

        } catch (err) {
            console.error('❌ 登录过程出错:', err);
            console.error('错误堆栈:', err.stack);
            return error(res, '登录失败，请稍后重试');
        }
    }

    /**
     * 用户登出
     */
    async logout(req, res) {
        try {
            const userId = req.user.id;
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (token) {
                // 删除会话记录
                await User.deleteSession(userId, token);
            }

            return success(res, '登出成功');

        } catch (err) {
            console.error('登出失败:', err);
            return error(res, '登出失败，请稍后重试');
        }
    }
    /**
     * 获取用户信息
     */
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);

            if (!user) {
                return unauthorized(res, '用户不存在');
            }

            // 获取用户积分信息
            let userPoints = 0;
            try {
                const pointsInfo = await UserPoints.findByUserId(userId);
                if (pointsInfo && pointsInfo.available_points !== undefined) {
                    userPoints = pointsInfo.available_points;
                }
            } catch (pointsError) {
                console.warn('获取用户积分信息失败:', pointsError);
                // 积分获取失败不影响用户信息获取
            }

            // 返回用户信息（不包含密码）
            const { password: _, avatar_url, ...userInfo } = user;
            
            // 确保返回的用户信息中包含所有前端需要的字段，特别是处理avatar字段
            const formattedUserInfo = {
                ...userInfo,
                avatar: avatar_url, // 将数据库中的avatar_url映射为前端期望的avatar字段
                nickname: user.nickname || '', // 确保昵称字段始终存在
                city: user.city || '', // 确保城市字段始终存在
                points: userPoints // 添加积分字段
            };

            return success(res, formattedUserInfo, '获取成功');

        } catch (err) {
            console.error('获取用户信息失败:', err);
            return error(res, '获取用户信息失败');
        }
    }

    /**
     * 更新用户信息
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { nickname, avatar_url, gender, birthday, city } = req.body;

            const updateData = {};
            
            if (nickname !== undefined) {
                updateData.nickname = nickname ? sanitizeString(nickname) : null;
            }
            if (avatar_url !== undefined) {
                updateData.avatar_url = avatar_url;
            }
            if (gender !== undefined) {
                updateData.gender = gender;
            }
            if (birthday !== undefined) {
                // 处理生日格式，确保是有效的日期格式
                if (birthday) {
                    // 如果是ISO格式的日期字符串，转换为YYYY-MM-DD格式
                    const date = new Date(birthday);
                    if (!isNaN(date.getTime())) {
                        // 转换为MySQL DATE格式 (YYYY-MM-DD)
                        updateData.birthday = date.toISOString().split('T')[0];
                    } else {
                        // 如果已经是YYYY-MM-DD格式，直接使用
                        updateData.birthday = birthday;
                    }
                } else {
                    updateData.birthday = null;
                }
            }
            if (city !== undefined) {
                updateData.city = city ? sanitizeString(city) : null;
            }

            await User.update(userId, updateData);
            const updatedUser = await User.findById(userId);

            // 返回更新后的用户信息（不包含密码）
            const { password: _, ...userInfo } = updatedUser;

            return success(res, userInfo, '更新成功');

        } catch (err) {
            console.error('更新用户信息失败:', err);
            return error(res, '更新用户信息失败');
        }
    }

    /**
     * 修改密码
     */
    async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { oldPassword, newPassword } = req.body;

            // 验证必填字段
            if (!validateRequired(oldPassword) || !validateRequired(newPassword)) {
                return badRequest(res, '旧密码和新密码不能为空');
            }

            // 验证新密码强度
            if (!validatePassword(newPassword)) {
                return badRequest(res, '新密码长度必须在6-20位之间');
            }

            // 获取用户信息
            const user = await User.findById(userId);
            if (!user) {
                return unauthorized(res, '用户不存在');
            }

            // 验证旧密码
            const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isOldPasswordValid) {
                return unauthorized(res, '旧密码错误');
            }

            // 加密新密码
            const saltRounds = 10;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

            // 更新密码
            await User.update(userId, { password: hashedNewPassword });

            return success(res, '密码修改成功');

        } catch (err) {
            console.error('修改密码失败:', err);
            return error(res, '修改密码失败');
        }
    }

    /**
     * 检查手机号是否已注册
     */
    async checkPhone(req, res) {
        try {
            const { phone } = req.body;

            // 验证手机号格式
            if (!validatePhone(phone)) {
                return badRequest(res, '手机号格式不正确');
            }

            // 检查手机号是否存在
            const existingUser = await User.findByPhone(phone);

            return success(res, '检查完成', {
                exists: !!existingUser
            });

        } catch (err) {
            console.error('检查手机号失败:', err);
            return error(res, '检查手机号失败');
        }
    }
}

module.exports = new AuthController();