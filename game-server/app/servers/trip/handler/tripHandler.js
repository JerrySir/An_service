
var async = require("async");
var userUtil = require('../../../util/user')

module.exports = function(app) {
  return new Handler(app);
};
  
var Handler = function(app) {
  this.app = app;
  this.channelService = app.get('channelService');
  this.backendSessionService = app.get('backendSessionService');
};

/**
 * 查询未完成的行程
 * 
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.queryUnfinished = function(msg, session, next) {
  var self = this;
  
  if (!session.uid) {
    next(null, {error: true, msg: 'user not entered.'});
    return;
  }

  var uid = session.uid;

  this.app.rpc.trip.tripRemote.queryUnfinished(session, uid, function(_err, _hasData, _ordernumber) {
    if (_err) {
      next(null, {error: true, msg: _err});
    } else if (!_hasData) {
      next(null, {error: false, msg: 'no trip.'});
    } else {
      next(null, {error: false, msg: 'has unfinished trip.', data: {ordernumber: _ordernumber}});
    }
  });
}

/**
 * 创建行程
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.create = function(msg, session, next) {
  var self = this;
  
  if (!session.uid) {
    next(null, {error: true, msg: 'user not entered.'});
    return;
  }

  var uid = session.uid;

  async.waterfall([
    function(_cb) {
      // 查询是否有未完成的行程
      self.app.rpc.trip.tripRemote.queryUnfinished(session, uid, function(_err, _hasData, _ordernumber) {
        if (_err) {
          _cb(_err);
        } else if (_hasData) {
          _cb('has unfinished.');
        } else {
          _cb(null);
        }
      });
    },
    function(_cb) {
      // 创建订单
      self.app.rpc.trip.tripRemote.create(session, uid, function(_err, _ordernumber) {
        if (_err) {
          _cb(_err);
        } else {
          _cb(null, _ordernumber);
        }
      });
    }
  ],function(_err, _ordernumber) {
    if (_err) {
      next(null, {error: true, msg: _err});
    } else {
      next(null, {error: false, msg: '行程创建成功', data:{ordernumber: _ordernumber}});
    }
  });
}

/**
 * 结束行程
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.end = function(msg, session, next) {
  var self = this;
  
  if (!session.uid) {
    next(null, {error: true, msg: 'user not entered.'});
    return;
  }

  // 检查参数
  // if (!msg.ordernumber) {
  //   next(null, {error: true, msg: '参数错误:缺少ordernumber参数'});
  //   return;
  // }
  // 其实一开始考虑上传ordernumber,后来觉得既然在房间内,就可以获取,所以采用下面的方法,更安全

  if (!session.get('rid')) {
    next(null, {error: true, msg: 'user not in trip room.'});
    return;
  }

  var uid = session.uid;
  var rid = session.get('rid');

  async.waterfall([
    function(_cb) {
      // 检查行程信息(当前状态、所属uid)
      self.app.rpc.trip.tripRemote.getInfo(session, rid, function(_err, _hasData, _uid, _state) {
        if (_err) {
          _cb(_err);
        } else if (!_hasData) {
          _cb('无此行程');
        } else if (_uid !== uid) {
          _cb('无权操作');
        } else if (_state !== 1) {
          // 不在进行中
          _cb('无效操作');
        } else {
          _cb();
        }
      });
    },
    function(_cb) {
      // 结束行程
      self.app.rpc.trip.tripRemote.end(session, rid, function(_err) {
        _cb(!!_err ? _err : null);
      });
    }
  ], function(_err) {
    if (_err) {
      next(null, {error: true, msg: _err});
    } else {
      // channel内成员rid清除
      /* 是真特么清除不了啊，BackendSession.prototype.set() 并不能调用
      var channel = self.channelService.getChannel(rid, false);
      if (!!channel) {
        console.log('.......', channel);
        for (var _index in channel.records) {
          console.log('这里是:', channel.records[_index]);
          var _sid = channel.records[_index]['sid'];
          var _uid = channel.records[_index]['uid'];
          self.backendSessionService.getByUid(_sid, _uid, function(__err, __session) {
            if (!__err) {
              console.log('__session:', __session);
              // __session.set('rid', null);
              console.log('这里能获取到吗？', __session.get('rid'));
              __session.push('rid', function(err) {
                if(err) {
                  console.error('entryHandler.leaveTripRoom: set rid for session service failed! error is : %j', err.stack);
                }
              });
            }
          });
        }
      }
      */
      // 发出通知
      var channel = self.channelService.getChannel(rid, false);
      if (!!channel) {
        channel.pushMessage({
          route: 'onEnd'
        })
      }
      // 销毁channel
      self.channelService.destroyChannel(rid);
      
      next(null, {error: false, msg: 'end trip success.'});
    }
  });
}

/**
 * 上报当前位置
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.uploadLocation = function(msg, session, next) {
  var self = this;
  
  if (!session.uid) {
    next(null, {error: true, msg: 'user not entered.'});
    return;
  }

  if (!session.get('rid')) {
    next(null, {error: true, msg: 'user not in trip room.'});
    return;
  }

  // 检查参数
  if (!msg.longitude) { // 经度
    next(null, {error: true, msg: '参数错误:缺少longitude参数'});
    return;
  }

  if (!msg.latitude) { // 纬度
    next(null, {error: true, msg: '参数错误:缺少latitude参数'});
    return;
  }

  var uid = session.uid;
  var rid = session.get('rid');
  var longitude = msg.longitude;
  var latitude = msg.latitude;

  async.waterfall([
    function(_cb) {
      // 检查行程信息(当前状态、所属uid)
      self.app.rpc.trip.tripRemote.getInfo(session, rid, function(_err, _hasData, _uid, _state) {
        if (_err) {
          _cb(_err);
        } else if (!_hasData) {
          _cb('无此行程');
        } else if (_uid !== uid) {
          _cb('无权操作');
        } else if (_state !== 1) {
          // 不在进行中
          _cb('无效操作');
        } else {
          _cb();
        }
      });
    },
    function(_cb) {
      // 添加位置记录
      self.app.rpc.trip.tripRemote.uploadLocation(session, rid, longitude, latitude, null, function(_err) {
        _cb(_err);
      });
    }
  ], function(_err) {
    next(null, {error: !!_err, msg: _err ? _err : 'upload trip location success.'});
  });
}

/**
 * 行程求助
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.SOS = function(msg, session, next) {
  var self = this;
  
  if (!session.uid) {
    next(null, {error: true, msg: 'user not entered.'});
    return;
  }

  if (!session.get('rid')) {
    next(null, {error: true, msg: 'user not in trip room.'});
    return;
  }

  var uid = session.uid;
  var rid = session.get('rid');

  async.waterfall([
    function(_cb) {
      // 检查行程信息(当前状态、所属uid)
      self.app.rpc.trip.tripRemote.getInfo(session, rid, function(_err, _hasData, _uid, _state) {
        if (_err) {
          _cb(_err);
        } else if (!_hasData) {
          _cb('无此行程');
        } else if (_uid !== uid) {
          _cb('无权操作');
        } else if (_state !== 1) {
          // 不在进行中
          _cb('无效操作');
        } else {
          _cb();
        }
      });
    },
    function(_cb) {
      // 记录日志
      self.app.rpc.trip.tripRemote.addLog(session, rid, 1, '发出求救', null, function(_err) {
        if (_err) {
          console.error('entryHandler.SOS: add log failed! error is : %j', _err.stack);
        }
        cb(); // 这里没想好怎么做错误处理,不管记录没记录都先发通知吧
      });
    },
    function(_cb) {
      // 发出通知
    }
  ], function(_err) {
    next(null, {error: !!_err, msg: _err ? _err : 'SOS message send.'});
  });
}

/**
 * 关注房主
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.follow = function(msg, session, next) {
  var self = this;
  
  if (!session.uid) {
    next(null, {error: true, msg: 'user not entered.'});
    return;
  }

  if (!session.get('rid')) {
    next(null, {error: true, msg: 'user not in trip room.'});
    return;
  }

  var uid = session.uid;
  var rid = session.get('rid');

  async.waterfall([
    function(_cb) {
      // 检查行程信息(所属uid)
      self.app.rpc.trip.tripRemote.getInfo(session, rid, function(_err, _hasData, _uid, _state) {
        if (_err) {
          _cb(_err);
        } else if (!_hasData) {
          _cb('无此行程');
        } else {
          _cb(null, _uid);
        }
      });
    },
    function(_uid, _cb) {
      // 查询当前关注状态
      
    },
    function(_uid, _cb) {
      // 添加关注绑定 关注人 被关注人 起始订单
      
    },
    function(_cb) {
      // 发出通知
    }
  ], function(_err) {
    next(null, {error: !!_err, msg: _err ? _err : 'SOS message send.'});
  });
}

/**
 * 取消关注房主
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.unfollow = function(msg, session, next) {}

/**
 * 获取行程信息(时间、日志、轨迹)
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
Handler.prototype.getInfo = function(msg, session, next) {}

/**
 * 获取行程房间内的用户信息
 * 
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 */
Handler.prototype.getUserInfoInTripRoom = function(msg, session, next) {
  // 检查用户id
  // 检查是否在房间内
  // var list = [1, 2];
  // var sql = 'SELECT * FROM user WHERE id in (' + list + ')'
  // console.log('SQL语句是:'+sql);
  // mysql.execute(sql, [], function(err, result){
  //   console.log(err, result);
  // });
}