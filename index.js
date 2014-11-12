var goodreads = require('goodreads');

var http = require('http');
var url = require('url');
var parser = require('xml2json');
var oauth = (require('oauth')).OAuth;

var originalDomain = 'http://127.0.0.1:6001/';

module.exports = function(hoodie, doneCallback) {

  // hoodie.task.on('goodreadslink:add', linkToGoodreads);
  hoodie.task.on('goodreadsgetinfo:add', getInfo);

  var onRequest = function(req, res){

    var goodreads_key = hoodie.config.get('goodreads_api_key');
    var goodreads_secret = hoodie.config.get('goodreads_api_secret');
    var fakeSession = {};

    var gr, oauthToken, oauthTokenSecret, params, pathname;
    pathname = url.parse(req.url).pathname;
    console.log('request for [' + pathname + '] received');
    var hoodie_id = url.parse(req.url, true).query.hoodie_id;
    console.log('doing the goodreads dance for: ', hoodie_id);

    // I'm sure that all of this isn't the best way to do this
    // But it's being a pain so this is a roundabout

    switch (pathname) {
      case '/oauth/goodreads':
      case '/oauth/goodreads/':
        console.log('go to goodreads');
        gr = new goodreads.client({
          'key': goodreads_key,
          'secret': goodreads_secret,
          'callback': 'http://127.0.0.1:6004/callback'
        });
        return gr.requestToken(function(callback) {
          fakeSession.oauthToken = callback.oauthToken;
          fakeSession.oauthTokenSecret = callback.oauthTokenSecret;
          res.writeHead('302', {
            'Location': callback.url
          });
          return res.end();
        });
      case '/callback':
        console.log('get callback');
        oauthToken = fakeSession.oauthToken;
        oauthTokenSecret = fakeSession.oauthTokenSecret;
        params = url.parse(req.url, true);
        // console.log(oauthToken, oauthTokenSecret, params.query.authorize);
        gr = new goodreads.client({
          'key': goodreads_key,
          'secret': goodreads_secret
        });

        var oa = new oauth(gr.options.oauth_request_url,
                           gr.options.oauth_access_url,
                           gr.options.key,
                           gr.options.secret,
                           gr.options.oauth_version,
                           gr.options.callback,
                           gr.options.oauth_encryption
                           );

        var getWrapper = function(url,
                                  oauthAccessToken,
                                  oauthAccessTokenSecret,
                                  callback){       
          oa.get(url,
                 oauthAccessToken,
                 oauthAccessTokenSecret,
                 function(error, data, response) {
            if (error){
              // console.log(error);
              res.write('<html><head><script src="http://fgnass.github.io/spin.js/dist/spin.min.js"></script></head><body onload="/*self.close();*/" style="margin:0; padding:0; width:100%; height: 100%; display: table;"><div style="display:table-cell; text-align:center; vertical-align: middle;"><div id="spin" style="display:inline-block;"></div></div><script>var spinner=new Spinner().spin(); document.getElementById("spin").appendChild(spinner.el);</script></body></html>');
              return res.end();
            } else {
              return callback(data);
            }
          });
        };

        var accessTokenCallback = function(error, oauthAccessToken, oauthAccessTokenSecret, results){
            getWrapper('http://www.goodreads.com/api/auth_user',
              oauthAccessToken,
              oauthAccessTokenSecret,
              function(data){
                var jsonData = parser.toJson(data, {object: true});
                var user_id = jsonData.GoodreadsResponse.user.id;
                goodreads = {
                  'id' : user_id,
                  'oauth_access_token' : oauthAccessToken,
                  'oauth_access_token_secret': oauthAccessTokenSecret
                };
                var updateVals = {
                  goodreads: goodreads
                };
                hoodie.account.update('user', hoodie_id, updateVals, function(err, data){
                  console.log('updated user object w/ goodreads data');
                  res.writeHead('302', {
                    'Location': 'http://127.0.0.1:6001/'
                  });
                  server.close();
                  return res.end();
                });
                
            });
        };

        return oa.getOAuthAccessToken(oauthToken,
                                      oauthTokenSecret,
                                      params.query.authorize,
                                      accessTokenCallback);
    }

    res.writeHead('302', {
      'Location': originalDomain
    });
    return res.end();
  };
  
  function linkToGoodreads(dbName) {
    console.log('Linking to goodreads');
  }

  function getInfo(dbName, options){
    hoodie.account.find('user', options.username, function(error, data){
      if (error){
        hoodie.task.success(dbName, options);
      } else {
        if (data.goodreads){
          options.goodreads_exists = true;
        } else {
          options.goodreads_exists = false;
        }
        hoodie.task.success(dbName, options);
      }
    });
  }

  var port = hoodie.config.get('port') || '6004';
  var server = http.createServer(onRequest).listen(port);
  console.log('Hoodie Goodreads Plugin: Listening on port ' + port);

  doneCallback();
};
