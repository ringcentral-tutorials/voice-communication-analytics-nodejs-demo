var path = require('path')

if('production' !== process.env.LOCAL_ENV )
  require('dotenv').load();

var express = require('express');
var session = require('express-session');

var app = express();
app.use(session({ secret: 'not-in-use', cookie: { maxAge: 24 * 60 * 60 * 1000 }}));
var bodyParser = require('body-parser');
var urlencoded = bodyParser.urlencoded({extended: false})

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(urlencoded);

var port = process.env.PORT || 5000

var server = require('http').createServer(app);
server.listen(port);
console.log("listen to port " + port)
var rc_engine = require('./engine');

app.get('/', function (req, res) {
  req.session.cookie = { maxAge: 24 * 60 * 60 * 1000 }
  if (!req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
  rc_engine.loadLogin(req, res)
})

app.get('/logout', function (req, res) {
  rc_engine.logout(req, res)
})

app.get('/readlog', function (req, res) {
  res.render('readlog')
})

app.get('/oauth2callback', function(req, res){
  rc_engine.login(req, res)
})

app.get('/about', function (req, res) {
  res.render('about')
})


app.post('/readlogs', function (req, res) {
  rc_engine.readCallRecordingsAsync(req, res)
})


app.get('/recordedcalls', function (req, res) {
  rc_engine.loadCallsFromDB(req, res)
})
app.post('/search', function (req, res) {
  rc_engine.searchCallsFromDB(req, res)
})

app.post('/transcribe', function (req, res) {
  rc_engine.transcriptCallRecording(req, res)
})

app.post('/analyze', function (req, res) {
  rc_engine.analyzeContent(req, res)
})

app.post('/remove', function (req, res) {
  rc_engine.removeItemFromDB(req, res)
})

app.post('/delete', function (req, res) {
  rc_engine.deleteItemFromCallLogDb(req, res)
})
