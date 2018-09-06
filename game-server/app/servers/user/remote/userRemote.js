
var userUtil = require('../../../util/user')
var mysql = require('../../../util/MySQL');

var async = require("async");

module.exports = function(app) {
	return new UserRemote(app);
};

var UserRemote = function(app) {
	this.app = app;
};

// 用户信息 ------ Start ------

/**
 * 设置用户信息
 * 
 * @param {String} uid 用户id,如果为null则添加新用户
 * @param {String} nickname 用户昵称
 * @param {String} avatar 用户头像url
 * @param {Number} state 状态 1:正常; 2:作废(过渡第三方); 3:封禁
 * @param {Function} cb 回调函数 err, uid
 */
UserRemote.prototype.setUser = function(uid, nickname, avatar, state, cb) {
	
	var executeSQL = '';
	var executeParams = [];
	
	if (!!uid) {
		// 更新用户信息
		executeSQL = 'UPDATE user SET '+
									'nick_name=IFNULL(?,nick_name), '+
									'avatar_url=IFNULL(?,avatar_url), '+
									'state=IFNULL(?,state) '+
									'WHERE id=?';
		executeParams = [nickname, avatar, state, uid];
	} else {
		// 添加用户信息
		executeSQL = 'INSERT INTO user SET nick_name=?, avatar_url=?, state=?';
		executeParams = [nickname, avatar, state];
	}
	
	mysql.execute(executeSQL, executeParams, function(err, result){
		if (err) {
			cb(err, null);
		} else if (result['affectedRows'] < 1) {
			cb('SQL语句执行未生效', null);
		} else {
			cb(null, !!uid ? uid : result['insertId']);
		}
	});
}

/**
 * 根据用户id获取用户信息(单个)
 * 
 * @param {String} uid 用户id
 * @param {Function} cb 回调函数 err, hasData, nickName, avatar, state, createdTime, lastUpdatedTime
 */
UserRemote.prototype.getInfo = function(uid, cb) {
	mysql.execute(
		'SELECT * FROM user WHERE id=?',
		[uid],
		function (_err, _result) {
			if (_err) {
				cb(_err, false);
			} else if (_result.length < 1) {
				cb(null, false); // 无数据
			} else {
				var nickName = _result[0]['nick_name'];
				var avatar = _result[0]['avatar_url'];
				var state = _result[0]['state'];
				var createdTime = _result[0]['created_time'];
				var lastUpdatedTime = _result[0]['last_updated_time'];
				
				cb(null, true, nickName, avatar, state, createdTime, lastUpdatedTime);
			}
		}
	);
}

/**
 * 根据用户id数组获取用户信息(组)
 * 
 * @param {Array} uidList 用户id数组
 * @param {Function} cb 回调函数 err, hasData, datas: [{nickName, avatarURL, state, createdTime, lastUpdatedTime}]
 */
UserRemote.prototype.getInfoList = function(uidList, cb) {
	mysql.execute(
		'SELECT * FROM user WHERE id in (' + uidList + ')', [],
		function (_err, _result) {
			if (_err) {
				cb(_err, false);
			} else if (_result.length < 1) {
				cb(null, false); // 无数据
			} else {
				var datas = _result.map((currentValue, index, arr) => {
					return {
						nickName: currentValue['nick_name'],
						avatarURL: currentValue['avatar_url'],
						state: currentValue['state'],
						createdTime: currentValue['created_time'],
						lastUpdatedTime: currentValue['last_updated_time']
					}
				});
				
				cb(null, true, datas);
			}
		}
	);
}

/**
 * 根据登录Token获取用户登录信息
 *
 * @param {String} token 登录Token
 * @param {Function} cb 回调函数 err, hasData, uid, platform, state, sessionKey, createdTime, lastUpdatedTime
 *
 */
UserRemote.prototype.getUserOnlineStateByToken = function(token, cb) {

	mysql.execute(
		'SELECT * FROM user_online_state WHERE client_token=?',
		[token],
		function (_err, _result) {

			if (_err) {
				cb(_err, false);
			} else if (_result.length < 1) {
				cb(null, false); // 无数据
			} else {
				var uid = _result[0]['user_id'];
				var platform = _result[0]['platform'];
				var state = _result[0]['state'];
				var sessionKey = _result[0]['server_session'];
				var createdTime = _result[0]['created_time'];
				var lastUpdatedTime = _result[0]['last_updated_time'];

				cb(null, true, uid, platform, state, sessionKey, createdTime, lastUpdatedTime);
			}
		}
	)
};

// 用户信息 ------ End ------

// 用户登录 ------ Start ------

/**
 * 设置用户登录状态
 * 
 * @param {String} uid 用户id
 * @param {Number} platform 平台 1:小程序
 * @param {Number} state 状态 1:生效中; 2:过期
 * @param {String} client 客户端Token
 * @param {String} server 第三方服务器Session key
 * @param {Function} cb err
 */
UserRemote.prototype.setUserOnlineState = function(uid, platform, state, token, sessionKey, cb) {
	mysql.execute(
		'INSERT INTO user_online_state SET user_id=?,platform=?, state=?, client_token=?, session_key=? ON DUPLICATE KEY UPDATE platform=?, state=?, client_token=?, session_key=?',
		[uid, platform, state, token, sessionKey,  platform, state, token, sessionKey],
		function (_err, _result) {

			var err = null;

			if (_err) {
				err = _err;
			} else if (!_result['insertId']) {
				err = 'database error: setUserOnlineState result insertId == null';
			}

			cb(err);
		}
	);
};

// 用户登录 ------ End ------

// 用户在线状态 ------ Start ------

/**
 * 根据第三方openid获取用户id
 * 
 * @param {Number} platform 平台 1:小程序
 * @param {String} openid 开放平台唯一id
 * @param {Function} cb 回调函数 err, hasData, userid
 */
UserRemote.prototype.getUseridByOpenid = function(platform, openid, cb) {
	mysql.execute(
		'SELECT * FROM user_bind WHERE platform=? AND open_id=?',
		[platform, openid],
		function (_err, _result) {
			if (_err) {
				cb(_err, false);
			} else if (_result.length < 1) {
				cb(null, false); // 无数据
			} else {
				var uid = _result[0]['user_id'];
				cb(null, true, uid);
			}
		}
	);
}

/**
 * 用户绑定第三方平台
 * 
 * @param {String} uid 用户id
 * @param {Number} platform 平台 1:小程序
 * @param {String} openid 开放平台唯一id
 * @param {Function} cb err
 */
UserRemote.prototype.bindingPlatformForUser = function(uid, platform, openid, cb) {
	mysql.execute(
		'INSERT INTO user_bind SET user_id=?,platform=?, open_id=?',
		[uid, platform, openid],
		function (_err, _result) {

			var err = null;

			if (_err) {
				err = _err;
			} else if (!_result['insertId']) {
				err = 'database error: bindingPlatformForUser result insertId == null';
			}

			cb(err);
		}
	);
}

// 用户在线状态 ------ End ------
