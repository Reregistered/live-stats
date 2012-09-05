/*
 */

var statsd = require('statsd-node')
  , Redis   = require('redis');


exports = module.exports = _ = {};

var rds_key = 'stats:live:';

var name_key = function(name){
  return rds_key + name;
}

module.exports.liveStatObj = function(params,cb){

  var localCallback = function(){};
  if (cb){
    var cbcount = 0;
    localCallback = function(err,res){
      cbcount++;
      if (err){
        cb(err);
      }
      else if (cbcount == 2){
        cb(null,1);
      }
    };
  }

  var pubsub = null;
  pubsub = Redis.createClient(params.port, params.host|| '127.0.0.1', params.options);
  pubsub.on('connect',localCallback);

  var rc = null;
  rc = Redis.createClient(params.port, params.host|| '127.0.0.1', params.options);
  rc.on('connect',localCallback);

  var stats = statsd.statsObj(params);
  stats.on('change', function(val){
    // update the pub/sub channel with the results

    var key = name_key(val.name);

    var res = JSON.stringify({name:val.name,value:val.value});
    pubsub.publish(key, res);
    rc.set([key, res]);

  });

  return stats;
};

module.exports.liveStatMonitor = function(params){

  var cb    = {};
  var stats = {};

  var pubsub  = null;
  var rc      = null;

  var initRedis = function (params, connect){

    connect = connect || function(){};

    pubsub = Redis.createClient(params.port, params.host|| '127.0.0.1', params.options);
    pubsub.on('connect', connect);

    rc = Redis.createClient(params.port, params.host|| '127.0.0.1', params.options);

  };


  var handleMessage = function(channel, sData){

    var data = JSON.parse(sData);
    
    stats[data.name] = data.value;

    if ( data.name in cb){
      cb[data.name](data);
    }
  };

  // setup the pub/sub channels
  initRedis(params, function(err,res){
    
    if (params.enableList){
      pubsub.subscribe(rds_key + '*');
    }
    pubsub.on('message', handleMessage);

  });

  var ret = {};

  ret.list = function(){
    // list out all of the live events we've seen up to now
    // and their latest value
    return stats;
  };

  ret.register = function (name,callback){

    var key = name_key(name);

    if (!(name in cb)){
      pubsub.subscribe(key);
    }
    cb[name] = callback;

    ///////////////
    // try and set it to the initial value
    rc.get([key], function(err,res){
      if ((!err) && (res)){
        handleMessage(key,res);
      }
    })
  };

  ret.unregister = function (name){
    if (name in cb){
      pubsub.unsubscribe(name_key(name));
      delete cb[name];      
    }
  };

  return ret;
};
