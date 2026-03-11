// src/models/Merchant.js
const db = require('../config/database');

class Merchant {
    /**
     * 根据用户ID查找商家信息
     * @param {number} userId - 用户ID
     * @returns {Promise<Object|null>} 商家信息或null
     */
    static async findByUserId(userId) {
        try {
            const query = 'SELECT * FROM merchants WHERE user_id = ?';
            const [rows] = await db.execute(query, [userId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('查找商家信息失败:', error);
            throw error;
        }
    }

    /**
     * 根据商家ID查找商家信息
     * @param {string} merchantId - 商家ID
     * @returns {Promise<Object|null>} 商家信息或null
     */
    static async findByMerchantId(merchantId) {
        try {
            const query = 'SELECT * FROM merchants WHERE id = ?';
            const [rows] = await db.execute(query, [merchantId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('根据商家ID查找商家信息失败:', error);
            throw error;
        }
    }

    /**
     * 查找一个可公开展示的默认商家
     * @returns {Promise<Object|null>} 默认商家信息
     */
    static async findDefaultMerchant() {
        try {
            const query = 'SELECT * FROM merchants ORDER BY updated_at DESC LIMIT 1';
            const [rows] = await db.execute(query);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('查找默认商家信息失败:', error);
            throw error;
        }
    }

    /**
     * 管理员根据商家ID更新营业状态
     * @param {string} merchantId - 商家ID（MER前缀或纯数字均可）
     * @param {number} isOpen - 营业状态 (1=营业, 0=打烊)
     * @returns {Promise<Object>} 操作结果
     */
    static async updateStatusByMerchantId(merchantId, isOpen) {
        try {
            console.log('=== updateStatusByMerchantId 开始 ===');
            console.log('商家ID:', merchantId);
            console.log('营业状态:', isOpen ? '营业' : '打烊');

            if (!merchantId) {
                return {
                    success: false,
                    message: '商家ID不能为空'
                };
            }

            // 规范化商家ID：如果没有MER前缀，则自动补充
            const normalizedId = merchantId.toString().startsWith('MER')
                ? merchantId.toString()
                : `MER${merchantId}`;

            const query = 'UPDATE merchants SET is_open = ? WHERE id = ?';
            const values = [isOpen ? 1 : 0, normalizedId];

            const [result] = await db.execute(query, values);

            console.log('更新结果:', result);
            console.log('影响行数:', result.affectedRows);

            if (result.affectedRows === 0) {
                return {
                    success: false,
                    message: '未找到对应商家记录'
                };
            }

            console.log('=== updateStatusByMerchantId 结束 ===');

            return {
                success: true,
                message: '营业状态更新成功',
                affectedRows: result.affectedRows
            };
        } catch (error) {
            console.error('管理员更新商家营业状态失败:', error);
            return {
                success: false,
                message: '更新营业状态失败',
                error: error.message
            };
        }
    }

    /**
     * 获取所有商家列表（公开接口）
     * @param {Object} options - 查询选项 { page, limit, category }
     * @returns {Promise<Object>} 商家列表和分页信息
     */
    static async findAll(options = {}) {
        try {
            const page = parseInt(options.page) || 1;
            const limit = parseInt(options.limit) || 100;
            const offset = (page - 1) * limit;
            const category = options.category;

            let query = `
                SELECT 
                    m.id,
                    m.user_id,
                    m.name,
                    m.category,
                    m.address,
                    m.phone,
                    m.business_hours,
                    m.description,
                    m.logo,
                    m.is_open,
                    m.rating,
                    m.min_order_amount,
                    m.delivery_fee,
                    m.contact_person,
                    mi.legal_person AS detail_contact_person,
                    mi.contact_phone AS detail_contact_phone,
                    u.nickname AS user_nickname,
                    u.phone AS user_phone,
                    COALESCE(m.contact_person, mi.legal_person, u.nickname) AS binding_contact_name,
                    COALESCE(u.phone, mi.contact_phone, m.phone) AS binding_contact_phone,
                    m.created_at,
                    m.updated_at
                FROM merchants m
                LEFT JOIN merchant_info mi ON mi.user_id = m.user_id
                LEFT JOIN users u ON u.id = m.user_id
                WHERE 1=1
            `;
            const params = [];

            // 如果指定了分类，添加分类筛选
            if (category) {
                query += ' AND category = ?';
                params.push(category);
            }

            // 添加排序和分页 - 直接拼接整数，避免参数类型问题
            const limitNum = parseInt(limit);
            const offsetNum = parseInt(offset);
            query += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

            console.log('执行SQL查询:', query);
            console.log('查询参数:', params);
            
            const [rows] = await db.execute(query, params);

            // 获取总数
            let countQuery = 'SELECT COUNT(*) as total FROM merchants m WHERE 1=1';
            const countParams = [];
            if (category) {
                countQuery += ' AND category = ?';
                countParams.push(category);
            }
            const [countRows] = await db.execute(countQuery, countParams);
            const total = countRows[0].total;

            return {
                merchants: rows,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('获取商家列表失败:', error);
            throw error;
        }
    }

    /**
     * 检查商家信息是否完善
     * @param {number} userId - 用户ID
     * @returns {Promise<boolean>} 是否完善
     */
    static async isInfoComplete(userId) {
        try {
            const merchant = await this.findByUserId(userId);
            if (!merchant) {
                return false;
            }
            
            // 检查关键字段是否都已填写
            const requiredFields = ['name', 'phone', 'address', 'business_hours', 'category'];
            return requiredFields.every(field => 
                merchant[field] && merchant[field].toString().trim() !== ''
            );
        } catch (error) {
            console.error('检查商家信息完善状态失败:', error);
            return false;
        }
    }

    /**
     * 创建或更新商家信息
     * @param {number} userId - 用户ID
     * @param {Object} merchantData - 商家信息
     * @returns {Promise<Object>} 操作结果
     */
    static async createOrUpdate(userId, merchantData) {
        try {
            // 生成唯一ID
            const generateId = () => `MER${Date.now()}${Math.floor(Math.random() * 1000)}`;
            
            // 检查是否已存在商家信息
            const existingMerchant = await this.findByUserId(userId);
            
            if (existingMerchant) {
                // 更新现有信息
                const fields = [];
                const values = [];
                
                // 遍历商家数据，构建更新语句
                Object.keys(merchantData).forEach(key => {
                    if (merchantData[key] !== undefined) {
                        fields.push(`${key} = ?`);
                        values.push(merchantData[key]);
                    }
                });
                
                if (fields.length > 0) {
                    values.push(userId);
                    const query = `UPDATE merchants SET ${fields.join(', ')} WHERE user_id = ?`;
                    await db.execute(query, values);
                }
                
                // 同步更新用户头像
                await this.syncMerchantLogoToUserAvatar();
                return { success: true, message: '商家信息更新成功', merchantId: existingMerchant.id };
            } else {
                // 创建新的商家信息
                const merchantId = generateId();
                
                const query = `
                    INSERT INTO merchants (
                        id, user_id, name, phone, contact_person, business_hours, 
                        address, category, description, min_order_amount, 
                        delivery_fee, delivery_scope
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                const values = [
                    merchantId,
                    userId,
                    merchantData.name || '',
                    merchantData.phone || '',
                    merchantData.contact_person || '',
                    merchantData.business_hours || '',
                    merchantData.address || '',
                    merchantData.category || '',
                    merchantData.description || '',
                    merchantData.min_order_amount || 0,
                    merchantData.delivery_fee || 0,
                    merchantData.delivery_scope || ''
                ];
                
                await db.execute(query, values);
                
                // 同步更新用户头像
                await this.syncMerchantLogoToUserAvatar();
                return { success: true, message: '商家信息创建成功', merchantId };
            }
        } catch (error) {
            console.error('创建或更新商家信息失败:', error);
            throw { success: false, message: '操作失败', error: error.message };
        }
    }

    /**
     * 获取商家详细信息，包含营业执照等信息
     * @param {number} userId - 用户ID
     * @returns {Promise<Object>} 商家详细信息
     */
    static async getMerchantInfoDetail(userId) {
         try {
             console.log('=== getMerchantInfoDetail 开始 ===');
             console.log('查询用户ID:', userId);
             
             const query = `
                SELECT 
                    mi.merchant_name,
                    mi.credit_code,
                    mi.legal_person,
                    mi.legal_phone,
                    mi.register_address,
                    mi.business_address,
                    mi.contact_phone,
                    mi.email,
                    mi.website,
                    mi.industry_type,
                    mi.sub_industry,
                    mi.establish_date,
                    mi.operate_period,
                    mi.status,
                    mi.merchant_id,
                    mi.business_license_image,
                    mi.restaurant_scene_image
                FROM merchant_info mi
                WHERE mi.user_id = ?
            `;
             
             console.log('执行SQL查询:', query);
             console.log('查询参数:', [userId]);
             
             const [result] = await db.execute(query, [userId]);
             
             console.log('SQL查询结果:', result);
             console.log('查询结果长度:', result.length);
             
             const merchantInfo = result.length > 0 ? result[0] : {};
             console.log('最终返回的商家信息:', merchantInfo);
             console.log('=== getMerchantInfoDetail 结束 ===');
             
             return merchantInfo;
         } catch (error) {
             console.error('获取商家详细信息失败:', error);
             throw error;
         }
     }

    /**
     * 同步商家logo到用户头像
     * 将users表中role_id=2的用户的avatar_url字段更新为对应merchants表中的logo字段值
     * @returns {Promise<Object>} 同步结果
     */
    static async syncMerchantLogoToUserAvatar() {
        try {
            // SQL更新语句，通过user_id关联两个表，只更新role_id=2的用户
            const query = `
                UPDATE users u
                JOIN merchants m ON u.id = m.user_id
                JOIN roles r ON u.role_id = r.id
                SET u.avatar_url = m.logo
                WHERE r.id = 2
            `;
            
            const [result] = await db.execute(query);
            
            return {
                success: true,
                message: `成功同步 ${result.affectedRows} 条记录`,
                affectedRows: result.affectedRows
            };
        } catch (error) {
            console.error('同步商家logo到用户头像失败:', error);
            throw {
                success: false,
                message: '同步失败',
                error: error.message
            };
        }
    }

    /**
     * 保存或更新商家详细信息到merchant_info表
     * @param {number} userId - 用户ID
     * @param {Object} merchantInfoData - 商家详细信息
     * @returns {Promise<Object>} 操作结果
     */
    static async saveMerchantInfoDetail(userId, merchantInfoData) {
        const connection = await db.getConnection();
        try {
            console.log('=== saveMerchantInfoDetail 开始 ===');
            console.log('用户ID:', userId);
            console.log('保存数据:', merchantInfoData);
            
            await connection.beginTransaction();
            
            // 检查是否已存在记录
            const existingQuery = 'SELECT * FROM merchant_info WHERE user_id = ?';
            const [existingRows] = await connection.execute(existingQuery, [userId]);
            
            // 过滤掉不应该直接设置的字段，转换日期格式
            const dataToSave = { ...merchantInfoData };
            delete dataToSave.merchant_id; // 移除merchant_id，让数据库自动生成
            delete dataToSave.created_at; // 移除创建时间，让数据库自动设置
            delete dataToSave.updated_at; // 移除更新时间，让数据库自动设置
            
            // 转换日期格式：ISO格式 -> YYYY-MM-DD
            if (dataToSave.establish_date) {
                try {
                    // 如果是ISO格式字符串，转换为DATE格式
                    const date = new Date(dataToSave.establish_date);
                    if (!isNaN(date.getTime())) {
                        dataToSave.establish_date = date.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.warn('日期转换失败，使用原始值:', dataToSave.establish_date);
                }
            }
            
            if (existingRows.length > 0) {
                // 更新现有记录
                console.log('更新现有merchant_info记录');
                
                const fields = [];
                const values = [];
                
                Object.keys(dataToSave).forEach(key => {
                    if (key !== 'user_id' && dataToSave[key] !== undefined) {
                        fields.push(`${key} = ?`);
                        values.push(dataToSave[key]);
                    }
                });
                
                if (fields.length > 0) {
                    values.push(userId);
                    const updateQuery = `UPDATE merchant_info SET ${fields.join(', ')} WHERE user_id = ?`;
                    const [result] = await connection.execute(updateQuery, values);
                    
                    console.log('更新结果:', result);
                }
            } else {
                // 创建新记录
                console.log('创建新的merchant_info记录');
                
                const insertFields = Object.keys(dataToSave).filter(key => 
                    key !== 'merchant_id' && dataToSave[key] !== undefined
                );
                const insertValues = insertFields.map(key => dataToSave[key]);
                const placeholders = insertValues.map(() => '?').join(', ');
                
                const insertQuery = `
                    INSERT INTO merchant_info (${insertFields.join(', ')})
                    VALUES (${placeholders})
                `;
                
                const [result] = await connection.execute(insertQuery, insertValues);
                
                console.log('插入结果:', result);
            }
            
            await connection.commit();
            console.log('=== saveMerchantInfoDetail 结束 ===');
            return {
                success: true,
                message: '商家详细信息保存成功'
            };
            
        } catch (error) {
            await connection.rollback();
            console.error('保存商家详细信息失败:', error);
            console.error('错误对象:', error);
            console.error('错误详情:', error.message);
            console.error('SQL错误:', error.sqlMessage || '无SQL错误信息');
            console.error('错误代码:', error.code || '无错误代码');
            
            return {
                success: false,
                message: '保存商家详细信息失败',
                error: error.message || String(error),
                sqlMessage: error.sqlMessage,
                errorCode: error.code
            };
        } finally {
            connection.release();
        }
    }

    /**
     * 查找merchant_info信息
     * @param {number} userId - 用户ID
     * @returns {Promise<Object|null>} merchant_info信息或null
     */
    static async findMerchantInfoByUserId(userId) {
        try {
            const query = 'SELECT * FROM merchant_info WHERE user_id = ?';
            const [rows] = await db.execute(query, [userId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('查找merchant_info信息失败:', error);
            throw error;
        }
    }

    /**
     * 同步merchants表和merchant_info表的数据
     * @param {number} userId - 用户ID
     * @returns {Promise<Object>} 同步结果
     */
    static async syncMerchantTables(userId) {
        try {
            console.log('=== syncMerchantTables 开始 ===');
            console.log('用户ID:', userId);
            
            // 获取merchants表的基本信息
            const merchant = await this.findByUserId(userId);
            if (!merchant) {
                return {
                    success: false,
                    message: '未找到商家基本信息'
                };
            }
            
            // 获取merchant_info表的详细信息
            const merchantInfo = await this.getMerchantInfoDetail(userId);
            
            // 合并数据
            const mergedData = {
                ...merchant,
                ...merchantInfo
            };
            
            console.log('合并后的数据:', mergedData);
            console.log('=== syncMerchantTables 结束 ===');
            
            return {
                success: true,
                message: '数据同步成功',
                data: mergedData
            };
        } catch (error) {
            console.error('同步商家表数据失败:', error);
            throw {
                success: false,
                message: '数据同步失败',
                error: error.message
            };
        }
    }

    /**
     * 更新商家营业状态
     * @param {number} userId - 用户ID
     * @param {number} isOpen - 营业状态 (1=营业, 0=打烊)
     * @returns {Promise<Object>} 操作结果
     */
    static async updateBusinessStatus(userId, isOpen) {
        try {
            console.log('=== updateBusinessStatus 开始 ===');
            console.log('用户ID:', userId);
            console.log('营业状态:', isOpen ? '营业' : '打烊');
            
            // 检查用户是否拥有商家记录
            const merchant = await this.findByUserId(userId);
            if (!merchant) {
                console.log('未找到商家记录，用户ID:', userId);
                return {
                    success: false,
                    message: '未找到商家信息，无法更新营业状态'
                };
            }
            
            // 更新is_open字段
            const query = 'UPDATE merchants SET is_open = ? WHERE user_id = ?';
            const values = [isOpen, userId];
            
            const [result] = await db.execute(query, values);
            
            console.log('更新结果:', result);
            console.log('影响行数:', result.affectedRows);
            
            console.log('=== updateBusinessStatus 结束 ===');
            
            return {
                success: true,
                message: '营业状态更新成功',
                affectedRows: result.affectedRows
            };
        } catch (error) {
            console.error('更新营业状态失败:', error);
            throw {
                success: false,
                message: '更新营业状态失败',
                error: error.message
            };
        }
    }
}

module.exports = Merchant;