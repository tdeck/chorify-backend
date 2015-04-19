var blockhash = require('blockhash'),
    jpeg = require('jpeg-js'),
    express = require('express'),
    bodyParser = require('body-parser'),
    uuid = require('node-uuid'),
    Q = require('q'),
    Pubnub = require('pubnub'),
    app = express();

app.use(bodyParser.json({limit:'2mb'}));

function hashJPEGData(data) {
  var imgData = jpeg.decode(data);

  if (!imgData) throw new Error("Couldn't decode image");

  return blockhash.blockhashData(imgData, 16, 2);
};

var DIRTY_THRESHOLD = 30;
var PUBNUB_KEY = process.env.PUBNUB_KEY;

var pubnub = Pubnub.init({
  publish_key: 'pub-c-35489623-546c-4c7a-ae0e-f5be885db61c'
});

var photoRequests = {};
var cleanHash = null;

function requestPhoto(time) {
  time = time || Date.now() / 1000;
  var id = uuid.v4();

  var deferred = Q.defer();
  photoRequests[id] = {
    id: id,
    time: time,
    deferred: deferred
  };

  return deferred.promise;
}

app.get('/_status', function(req, res) {
  res.send('OK');
});

app.delete('/admin/checks', function(req, res) {
  for (var id in photoRequests) {
    delete photoRequests[id];
  }
  res.status(200).end();
});

app.put('/admin/isclean', function(req, res) {
  requestPhoto().then(function(hash) {
    cleanHash = hash;
    console.log('Clean', hash);
    res.status(200).end();
  });
});

app.post('/admin/checks', function(req, res) {
  if (!req.body.time) {
    return res.status(400).json({
      error: 'Missing required parameter `time`'
    });
  }

  res.status(202).end();

  requestPhoto(req.body.time).then(function(hash) {
    var distance = blockhash.hammingDistance(hash, cleanHash);
    
    var message = (distance > DIRTY_THRESHOLD) ? 'dirty' : 'clean';
    console.log(message, ', hamming distance:', distance);

    pubnub.publish({
      channel: 'chorify',
      message: message
    });
  });
});

app.post('/captures', function(req, res) {
  if (!req.body.schedule_id) {
    return res.status(400).json({
      error: 'Missing required parameter `schedule_id`'
    });
  }
  if (!req.body.image_data) {
    return res.status(400).json({
      error: 'Missing required parameter `image_data`'
    });
  }

  if (!photoRequests[req.body.schedule_id]) res.status(202).end();

  var raw_image = new Buffer(req.body.image_data, 'base64');
  var hash = hashJPEGData(raw_image);

  var sched = photoRequests[req.body.schedule_id];
  sched.deferred.resolve(hash);

  delete photoRequests[req.body.schedule_id];

  res.status(202).end();
});

app.get('/schedule', function(req, res) {
  var result = [];
  for (var id in photoRequests) {
    result.push({
      id: id,
      time: photoRequests[id].time
    });
  }
  res.json(result);
});

var port = process.env.PORT || 8888;
app.listen(port);
console.log("Running on port", port);
