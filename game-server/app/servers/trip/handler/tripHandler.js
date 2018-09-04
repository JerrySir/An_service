module.exports = function(app) {
  return new Handler(app);
};
  
var Handler = function(app) {
  this.app = app;
};

/**
 * 查询未完成的行程
 * 
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.queryUnfinished = function(msg, session, next) {}

/**
 * 创建行程
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.create = function(msg, session, next) {}

/**
 * 结束行程
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.end = function(msg, session, next) {}

/**
 * 上报当前位置
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.uploadLocation = function(msg, session, next) {}

/**
 * 获取行程信息(时间、日志、轨迹)
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.get = function(msg, session, next) {}
