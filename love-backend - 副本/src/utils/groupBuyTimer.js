const GroupBuy = require('../models/GroupBuy');
const GroupBuyActivity = require('../models/GroupBuyActivity');
const GroupBuyMember = require('../models/GroupBuyMember');

/**
 * 定时检查拼团状态
 * 检查超时未成团的拼团，自动将其状态更新为失败
 */
async function checkGroupBuyStatus() {
    try {
        const now = new Date();
        
        // 查询所有进行中且已超时的拼团
        const expiredGroups = await GroupBuy.findByExpiredAndActive();
        
        if (expiredGroups.length > 0) {
            console.log(`发现 ${expiredGroups.length} 个超时未成团的拼团，开始处理...`);
            
            for (const group of expiredGroups) {
                try {
                    // 将拼团状态更新为失败
                    await GroupBuy.updateStatus(group.id, 2);
                    
                    // 更新所有成员的退款状态
                    await GroupBuyMember.updateRefundStatus(group.id, 1);
                    
                    console.log(`拼团ID: ${group.id} 已超时，状态更新为失败`);
                } catch (error) {
                    console.error(`处理拼团ID: ${group.id} 时出错:`, error);
                }
            }
        }
        
        // 检查并更新活动状态
        await checkAndUpdateActivityStatus();
        
    } catch (error) {
        console.error('检查拼团状态时出错:', error);
    }
}

/**
 * 检查并更新活动状态
 * 根据活动的开始和结束时间自动更新状态
 */
async function checkAndUpdateActivityStatus() {
    try {
        const now = new Date();
        
        // 查询所有未开始但已到开始时间的活动
        const pendingActivities = await GroupBuyActivity.findPendingAndNeedStart(now);
        
        if (pendingActivities.length > 0) {
            for (const activity of pendingActivities) {
                try {
                    await GroupBuyActivity.updateStatus(activity.id, 1);
                    console.log(`活动ID: ${activity.id} 已开始，状态更新为进行中`);
                } catch (error) {
                    console.error(`更新活动ID: ${activity.id} 状态时出错:`, error);
                }
            }
        }
        
        // 查询所有进行中但已到结束时间的活动
        const activeActivities = await GroupBuyActivity.findActiveAndNeedEnd(now);
        
        if (activeActivities.length > 0) {
            for (const activity of activeActivities) {
                try {
                    await GroupBuyActivity.updateStatus(activity.id, 2);
                    console.log(`活动ID: ${activity.id} 已结束，状态更新为已结束`);
                    
                    // 同时将该活动下的所有进行中拼团标记为失败
                    await GroupBuy.updateStatusByActivityId(activity.id, 2);
                    
                    // 获取该活动下的所有拼团
                    const groups = await GroupBuy.findByActivityId(activity.id);
                    
                    // 更新这些拼团成员的退款状态
                    for (const group of groups) {
                        if (group.status === 0) {
                            await GroupBuyMember.updateRefundStatus(group.id, 1);
                        }
                    }
                } catch (error) {
                    console.error(`更新活动ID: ${activity.id} 状态时出错:`, error);
                }
            }
        }
        
    } catch (error) {
        console.error('检查活动状态时出错:', error);
    }
}

/**
 * 启动拼团状态检查定时器
 * @param {number} interval 检查间隔（毫秒），默认60秒
 */
function startGroupBuyTimer(interval = 60000) {
    console.log(`启动拼团状态检查定时器，检查间隔: ${interval / 1000} 秒`);
    
    // 立即执行一次检查
    checkGroupBuyStatus();
    
    // 设置定时检查
    const timer = setInterval(checkGroupBuyStatus, interval);
    
    return timer;
}

// 导出函数
module.exports = {
    startGroupBuyTimer,
    checkGroupBuyStatus,
    checkAndUpdateActivityStatus
};