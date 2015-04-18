var blockhash = require('blockhash'),
    jpeg = require('jpeg-js'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express();

app.use(bodyParser.json());

function hashJPEGData(data, bits, method) {
  var imgData = jpeg.decode(data);

  if (!imgData) throw new Error("Couldn't decode image");

  return blockhash.blockhashData(imgData, bits, method);
};

app.post('/captures', function(req, res) {
  if (!req.body.image_data) {
    return res.status(400).json({
      error: 'Missing required parameter `image_data`'
    });
  }

  var raw_image = new Buffer(req.body.image_data, 'base64');

  res.json({
    hash: hashJPEGData(raw_image)
  });
});

app.get('/schedule', function(req, res) {
  res.json({
      'sched1': {
        time: 0
      },
      'sched2': {
        time: 0
      }
  });
});

var port = process.env.PORT || 8888;
app.listen(port);
console.log("Running on port", port);
