// 图片URL处理工具
const app = getApp();
const BASE_URL = app.globalData.baseUrl.replace('/api', ''); // 移除/api后缀

/**
 * 将相对路径转换为完整的后端图片URL
 * @param {string} relativePath - 相对路径，如 '/img/huawei2.jpg'
 * @returns {string} 完整的图片URL
 */
function getFullImageUrl(relativePath) {
  if (!relativePath) return '';
  
  // 如果已经是完整URL则直接返回
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  
  // 处理相对路径，确保路径格式正确
  let path = relativePath;
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // 对于/img开头的路径，添加/uploads前缀
  if (path.startsWith('/img')) {
    path = '/uploads' + path;
  }
  
  return BASE_URL + path;
}

module.exports = {
  getFullImageUrl
};