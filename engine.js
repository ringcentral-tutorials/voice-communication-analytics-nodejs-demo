var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
const sqlite3 = require('sqlite3').verbose();
var USERS_DATABASE = './db/users.db';
var watson = require('./watson');

require('dotenv').load()

var rcsdk = null
if (process.env.MODE == "production"){
  rcsdk = new RC({
    server:RC.server.production,
    appKey: process.env.CLIENT_ID_PROD,
    appSecret:process.env.CLIENT_SECRET_PROD
  })
}else{
  rcsdk = new RC({
      server:RC.server.sandbox,
      appKey: process.env.CLIENT_ID_SB,
      appSecret:process.env.CLIENT_SECRET_SB
    })
}

var platform = rcsdk.platform()
var subscription = rcsdk.createSubscription()
var users = []
var categoryArr = []

var emptyFields = ',"","","","","all",0,0,0,"","","",""'
var userLevel = 'user'
var gId = 0

function User(id) {
  this.id = id;
  this.admin = false;
  this.extensionId = "";
  this.token_json = {};
  this.extensionList = []
  this.categoryList = []
}

User.prototype = {
  setExtensionId: function(id) {
    this.extensionId = id
  },
  setAdmin: function() {
    this.admin = true
  },
  setUserToken: function (token_json){
    this.token_json = token_json
  },
  setUserExtensionList: function (extList){
    this.extensionList = extList
  },
  setCategoryList: function (catList){
    this.categoryList = catList
  },
  getUserId: function(){
    return this.id
  },
  getExtensionId: function(){
    return this.extensionId
  },
  getUserToken: function () {
    return this.token_json;
  },
  getExtensionList: function(){
    return this.extensionList;
  },
  getUserTable: function(){
    return "user_" + this.extensionId
  },
  getCategoryList: function(){
    return this.categoryList
  }
}

function getPlatform(userIndex){
  console.log("userIndex: " + userIndex)
  var token = users[userIndex].getUserToken()
  var data = platform.auth().data();
  data.token_type = token.token_type
  data.expires_in = token.expires_in
  data.access_token = token.access_token
  data.refresh_token_expires_in = token.refresh_token_expires_in
  platform.auth().setData(data)
  return platform
}

function getUserIndex(id){
  for (var i=0; i<users.length; i++){
    var user = users[i]
    if (id == user.getUserId()){
      return i
    }
  }
  return -1
}

var databaseName = ''
var engine = module.exports = {
  forceLogin: function(req, res){
    console.log("forceLogin")
    req.session.destroy();
    var p = rcsdk.platform()
    res.render('index', {
      authorize_uri: p.loginUrl({ // authUrl
        brandId: process.env.RINGCENTRAL_BRAND_ID,
        redirectUri: process.env.RC_APP_REDIRECT_URL
      }),
      redirect_uri: process.env.RC_APP_REDIRECT_URL,
      token_json: ''
    });
  },
  loadLogin: function(req, res){
    if (req.session.userId == 0) {
      var id = new Date().getTime()
      req.session.userId = id;
      var user = new User(id)
      users.push(user)
      var p = rcsdk.platform()
      res.render('index', {
        authorize_uri: p.loginUrl({
          brandId: process.env.RINGCENTRAL_BRAND_ID,
          redirectUri: process.env.RC_APP_REDIRECT_URL
        }),
        redirect_uri: process.env.RC_APP_REDIRECT_URL,
        token_json: ''
      });
    }else{
      var index = getUserIndex(req.session.userId)
      if (index >= 0)
        res.render('readlog')
      else
        engine.forceLogin(req, res)
    }
  },
  login: function(req, res){
    var thisReq = req
    if (req.query.code) {
        platform.login({
          code: req.query.code,
          redirectUri: process.env.RC_APP_REDIRECT_URL
        })
        .then(function (token) {
          var json = token.json()
          var newToken = {}
          newToken['access_token'] = json.access_token
          newToken['expires_in'] = json.expires_in
          newToken['token_type'] = json.token_type
          newToken['refresh_token'] = json.refresh_token
          newToken['refresh_token_expires_in'] = json.refresh_token_expires_in
          var userIndex = getUserIndex(thisReq.session.userId)
          if (userIndex < 0)
            return
          else {
            users[userIndex].setUserToken(newToken)
            users[userIndex].setExtensionId(json.owner_id)
          }
          res.send('login success');
          var p = getPlatform(userIndex)
          p.get('/account/~/extension/~/')
            .then(function(response) {
              var jsonObj = response.json();
              var table = users[userIndex].getUserTable()
              createTable(table)
              if (jsonObj.permissions.admin.enabled){
                engine.getAccountExtensions(userIndex)
              }else{
                var item = {}
                var extensionList = []
                item['id'] = jsonObj.id
                item['extNum'] = jsonObj.extensionNumber.toString()
                item['fullName'] = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                extensionList.push(item)
                users[userIndex].setUserExtensionList(extensionList)
              }
            })
            .catch(function(e) {
                console.log("Failed")
                console.error(e);
            });
        })
        .catch(function (e) {
          console.log('ERR ' + e.message || 'Server cannot authorize user');
          res.send('Login error ' + e);
        });
    } else {
      res.send('No Auth code');
    }
  },
  logout: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0){
      return engine.forceLogin(req, res)
    }
    var p = getPlatform(index)
    p.logout()
      .then(function (token) {
        p.auth().cancelAccessToken()
        users.splice(index, 1);
        return engine.forceLogin(req, res)
      })
      .catch(function (e) {
        console.log('ERR ' + e.message || 'Server cannot authorize user');
        res.send('Login error ' + e);
      });
  },
  getAccountExtensions: function (index){
    var endpoint = '/restapi/v1.0/account/~/extension'
    var params = {
        status: "Enabled",
        type: "User",
        perPage: 1000
    }
    var p = getPlatform(index)
    p.get(endpoint, params)
      .then(function(resp){
        var json = resp.json()
        var extensionList = []
        for (var record of json.records){
          var item = {}
          item['id'] = record.id
          item['extNum'] = record.extensionNumber.toString()
          item['fullName'] = record.contact.firstName + " " + record.contact.lastName
          console.log(item.fullName)
          extensionList.push(item)
        }
        users[index].setUserExtensionList(extensionList)
      })
      .catch(function(e){
        throw e
      })
  },
  readCategories: function(index, nextQuery, retObj, res, field, keyword){
      let db = new sqlite3.Database(USERS_DATABASE);
      var query = "SELECT categories FROM " + users[index].getUserTable();
      var categoryArr = []
      db.serialize(function() {
        db.all(query, function(err, allRows) {
          if(err != null){
            return categoryArr
            callback(err);
          }
          if (allRows.length == 0){
            var response = {}
            res.send(response)
          }else
            categoryArr.push("Unclassified")
            for (var item of allRows){
              var cat = unescape(item.categories)
              if (cat.length > 0){
                var c = JSON.parse(cat)
                if (c.length > 0){
                  for (var o of c){
                    var arr = o.split("/")
                    for (var a of arr){
                      if (a.length){
                        var newItem = true
                        for (var existCat of categoryArr){
                          if (existCat == a){
                            newItem = false
                            break
                          }
                        }
                        if (newItem){
                          //console.log("item: " + a)
                          categoryArr.push(a)
                        }
                      }
                    }
                  }
                }
              }
            }
            db.close();
            users[index].setCategoryList(categoryArr)
            retObj['categories'] = JSON.stringify(categoryArr)
            engine.readFullData(index, nextQuery, retObj, res, field, keyword)
        });
      });
    },
    removeItemFromDB: function(req, res){
      var index = getUserIndex(req.session.userId)
      if (index < 0){
        return engine.forceLogin(req, res)
      }
      let db = new sqlite3.Database(USERS_DATABASE);
      var query = "DELETE FROM " + users[index].getUserTable() + " WHERE id=" + req.body.id;
      db.run(query, function (err, result) {
        if (err){
          res.send('{"status":"error"}')
          return console.error(err.message);
        }
        res.send('{"status":"ok"}')
      });
    },
    deleteItemFromCallLogDb: function(req, res){
      var index = getUserIndex(req.session.userId)
      if (index < 0){
        return engine.forceLogin(req, res)
      }
      var p = getPlatform(index)
      var thisRes = res
      var thisReq = req
      if (req.body.MsgType == "PR"){
        let db = new sqlite3.Database(USERS_DATABASE);
        var query = "DELETE FROM " + users[index].getUserTable() + " WHERE id=" + req.body.id;
        db.get(query, function (err, result) {
          if (err){
            thisRes.send('{"status":"error"}')
            return console.error(err.message);
          }
          thisRes.send('{"status":"ok"}')
        });
      }else{
        var endpoint = '/restapi/v1.0/account/~/call-log/' + req.body.rec_id
        p.delete(endpoint)
          .then(function(){
            let db = new sqlite3.Database(USERS_DATABASE);
            var query = "DELETE FROM " + users[index].getUserTable() + " WHERE id=" + req.body.id;
            db.get(query, function (err, result) {
              if (err){
                thisRes.send('{"status":"error"}')
                return console.error(err.message);
              }
              thisRes.send('{"status":"ok"}')
            });

          })
          .catch(function(e){
            console.log(e)
            thisRes.send('{"status":"error"}')
          })
      }
    },
    transcriptCallRecording: function(req, res){
      var index = getUserIndex(req.session.userId)
      if (index < 0){
        return engine.forceLogin(req, res)
      }
      getAudioFile(index, req.body, res)
    },
    analyzeContent: function(req, res){
      var index = getUserIndex(req.session.userId)
      if (index < 0){
        return engine.forceLogin(req, res)
      }
      var p = getPlatform(index)
      let db = new sqlite3.Database(USERS_DATABASE);
      var query = "SELECT * FROM " + users[index].getUserTable() + " WHERE id=" + req.body.CallId;
      db.get(query, function (err, result) {
        if (err){
          return console.error(err.message);
        }

        result.recordingUrl = p.createUrl(result.recordingUrl, {addToken: true});
        result.conversations = unescape(result.conversations)
        result.entities = unescape(result.entities)
        result.keywords = unescape(result.keywords)
        result.sentiment = unescape(result.sentiment)
        result.actions = unescape(result.actions)
        result.wordswithoffsets = unescape(result.wordswithoffsets)

        res.render('recordedcall', {
          results: result,
          searchWord: req.body.searchWord
        })
      });
    },
    readCallRecordingsAsync: function(req, res){
      var index = getUserIndex(req.session.userId)
      if (index < 0){
        return engine.forceLogin(req, res)
      }
      extIndex = 0
      readExtensionCallLog(req.body, res, index)
    },
    searchCallsFromDB: function(req, res){
      var index = getUserIndex(req.session.userId)
      if (index < 0){
        return engine.forceLogin(req, res)
      }
      var posVal = req.body.positiveRange/1000
      var negVal = (req.body.negativeRange/1000) * -1

      var query = "SELECT id, rec_id, date, type, extensionNum, fullName, recordingUrl, transcript, processed, fromRecipient, toRecipient, sentiment_label, sentiment_score_hi, sentiment_score_low, keywords FROM " + users[index].getUserTable() + " WHERE "
      var typeQuery = ""
      if (req.body.types != "all"){
        var checkType = req.body.types
        typeQuery = "type='" + checkType + "' AND "
      }
      var searchArg = req.body.search.trim()
      query += typeQuery
      if (req.body.fields == "all"){
        if (searchArg == "*") {
          if (req.body.sentiment == "positive")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "sentiment_label='" + req.body.sentiment + "'";
          else{
            req.body.positiveRange = 1
            req.body.negativeRange = 1
            query += "(sentiment_score_low <= 0 OR sentiment_score_hi >= 0)";
          }
        }else{
          if (req.body.sentiment == "all"){
            query += "processed=1 AND ("
            query += "transcript LIKE '%" + searchArg + "%' OR "
            query += "keywords LIKE '%" + searchArg + "%' OR "
            query += "fromRecipient LIKE '%" + searchArg + "%' OR "
            query += "toRecipient LIKE '%" + searchArg + "%' OR "
            query += "extensionNum LIKE '%" + searchArg + "%' OR "
            query += "categories LIKE '%" + searchArg + "%')"
          }else{
            query += "processed=1 AND ("
            query += "transcript LIKE '%" + searchArg + "%' OR "
            query += "keywords LIKE '%" + searchArg + "%' OR "
            query += "fromRecipient LIKE '%" + searchArg + "%' OR "
            query += "toRecipient LIKE '%" + searchArg + "%' OR "
            query += "extensionNum LIKE '%" + searchArg + "%' OR "
            query += "categories LIKE '%" + searchArg + "%') AND "
            query += "sentiment_label='" + req.body.sentiment + "'";
          }
        }
      }else if (req.body.fields == "transcript"){
        query += "processed=1 AND "
        if (searchArg == "*") {
          if (req.body.sentiment == "positive")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "sentiment_label='" + req.body.sentiment + "'";
          else{
            query += "(sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
          }
        }else{
          if (req.body.sentiment == "positive")
            query += "transcript LIKE '% " + searchArg + " %' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "transcript LIKE '% " + searchArg + " %' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "transcript LIKE '% " + searchArg + " %' AND sentiment_label='" + req.body.sentiment + "'";
          else
            query += "transcript LIKE '% " + searchArg + " %' AND (sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
        }
      }else if (req.body.fields == "keywords"){
        query += "processed=1 AND "
        if (searchArg == "*") {
          if (req.body.sentiment == "positive")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "sentiment_label='" + req.body.sentiment + "'";
          else{
            query += "(sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
          }
        }else{
          if (req.body.sentiment == "positive")
            query += "keywords LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "keywords LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "keywords LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "'";
          else
            query += "keywords LIKE '%" + searchArg + "%' " + " AND (sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
        }
      }else if (req.body.fields == "from"){
        if (searchArg == "*") {
          if (req.body.sentiment == "positive")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "sentiment_label='" + req.body.sentiment + "'";
          else
            query += "(sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
        }else{
          if (req.body.sentiment == "positive")
            query += "fromRecipient LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi > " + posVal;
          else if (req.body.sentiment == "negative")
            query += "fromRecipient LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low < " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "fromRecipient LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "'";
          else
            query += "fromRecipient LIKE '%" + searchArg + "%'" // + " AND (sentiment_score_low < " + negVal + " OR sentiment_score_hi > " + posVal + ")";
        }
      }else if (req.body.fields == "to"){
        if (searchArg == "*") {
          if (req.body.sentiment == "positive")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi > " + posVal;
          else if (req.body.sentiment == "negative")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low < " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "sentiment_label='" + req.body.sentiment + "'";
          else
            query += "(sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
        }else{
          if (req.body.sentiment == "positive")
            query += "toRecipient LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "toRecipient LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "toRecipient LIKE '%" + searchArg + "%' AND sentiment_label='" + req.body.sentiment + "'";
          else
            query += "toRecipient LIKE '%" + searchArg + "%'" // + " AND (sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
        }
      }else if (req.body.fields == "extension"){
        if (searchArg == "*") {
          if (req.body.sentiment == "positive")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "sentiment_label='" + req.body.sentiment + "'";
          else
            query += "(sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
        }else{
          if (req.body.sentiment == "positive")
            query += "extensionNum=" + searchArg + " AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
          else if (req.body.sentiment == "negative")
            query += "extensionNum=" + searchArg + " AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
          else if (req.body.sentiment == "neutral")
            query += "extensionNum=" + searchArg + " AND sentiment_label='" + req.body.sentiment + "'";
          else
            query += "extensionNum=" + searchArg + " AND (sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
        }
      }else if (req.body.fields == "categories"){
        query += "processed=1 AND categories LIKE '%" + escape(req.body.categories) + "%'"
        if (req.body.sentiment == "positive")
          query += " AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_hi >= " + posVal;
        else if (req.body.sentiment == "negative")
          query += " AND sentiment_label='" + req.body.sentiment + "' AND sentiment_score_low <= " + negVal;
        else if (req.body.sentiment == "neutral")
          query += " AND sentiment_label='" + req.body.sentiment + "'";
        else
          query += " AND (sentiment_score_low <= " + negVal + " OR sentiment_score_hi >= " + posVal + ")";
      }
      var retObj = {}
      retObj['catIndex'] = req.body.categories
      retObj['searchArg'] = searchArg
      retObj['sentimentArg'] = req.body.sentiment
      retObj['fieldArg'] = req.body.fields
      retObj['typeArg'] = req.body.types
      retObj['posVal'] = req.body.positiveRange
      retObj['negVal'] = req.body.negativeRange
      if (users[index].getCategoryList().length == 0){
        engine.readCategories(index, query, retObj, res, searchArg)
      }else{
        retObj['categories'] = JSON.stringify(users[index].getCategoryList())
        engine.readFullData(index, query, retObj, res, req.body.fields, searchArg)
      }
    },
    readFullData: function(index, query, retObj, res, field, keyword){
      let db = new sqlite3.Database(USERS_DATABASE);
      db.all(query, function (err, result) {
        if (err){
          return console.error(err.message);
        }
        if (field != null && field == 'keywords'){
          for (var i = 0; i < result.length; i++){
            var r = result[i]
            var kwObj = JSON.parse(unescape(r.keywords))
            for (var kw of kwObj){
              if (kw.text == keyword){
                result[i]['score'] = kw.relevance
                break
              }
            }
          }
          result.sort(sortScores)
        }else
          result.sort(sortDates)
        var p = getPlatform(index)
        for (var i=0; i<result.length; i++){
          if (result[i].type == "CR" || result[i].type == "VM"){
            result[i].recordingUrl = p.createUrl(result[i].recordingUrl, {addToken: true});
          }
        }
        res.render('recordedcalls', {
            calls: result,
            categories: retObj.categories,
            catIndex: retObj.catIndex,
            searchArg: retObj.searchArg,
            sentimentArg: retObj.sentimentArg,
            fieldArg: retObj.fieldArg,
            typeArg: retObj.typeArg,
            posVal:retObj.posVal,
            negVal:retObj.negVal,
            itemCount: result.length
          })
      });
    },
    loadCallsFromDB: function(req, res){
      var index = getUserIndex(req.session.userId)
      if (index < 0){
        return engine.forceLogin(req, res)
      }
      var query = "SELECT id, rec_id, date, type, extensionNum, fullName, recordingUrl, transcript, processed, fromRecipient, toRecipient, sentiment_label, sentiment_score_hi, sentiment_score_low FROM " + users[index].getUserTable();
      var retObj = {}
      retObj['catIndex'] = "Unclassified"
      retObj['searchArg'] = "*"
      retObj['sentimentArg'] = 'all'
      retObj['fieldArg'] = 'all'
      retObj['typeArg'] = 'all'
      retObj['posVal'] = 500
      retObj['negVal'] = 500
      if (users[index].getCategoryList().length == 0){
        engine.readCategories(index, query, retObj, res, null, "")
      }else{
        retObj['categories'] = JSON.stringify(users[index].getCategoryList())
        engine.readFullData(index, query, retObj, res, null, "")
      }
    }
}

function getAudioFile(index, body, res){
  var table = users[index].getUserTable()
  var p = getPlatform(index)
  var obj = body
  var thisRes = res
  p.get(body.recordingUrl)
    .then(function(res) {
      return res.response().buffer();
    })
    .then(function(buffer) {
      var stream = require('stream');
      var bufferStream = new stream.PassThrough();
      // Write your buffer
      bufferStream.end(buffer);
      users[index].setCategoryList([])
      watson.transcribe(table, thisRes, body, bufferStream)
    })
    .catch(function(e){
      console.log(e)
      throw e
    })
}

var extIndex = 0
function readExtensionCallLog(body, res, userIndex){
  var ext = users[userIndex].getExtensionList()[extIndex]
  var extensionList = users[userIndex].getExtensionList()
  var endpoint = '/account/~/extension/'+ ext.id +'/call-log'
  var thisBody = body
  var thisRes = res
  var params = {
    view: "Detailed",
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    showBlocked: true,
    type: "Voice",
    perPage: 1000
  }

  var p = getPlatform(userIndex)
  async.waterfall([
      _function(p, res, endpoint, params, userIndex, extensionList)
    ], function (error, success) {
        if (error) {
          console.log('Something is wrong!');
        }
        extIndex++
        if (extIndex < extensionList.length){
          setTimeout(function(){
            readExtensionCallLog(thisBody, thisRes, userIndex)
          }, 1000)
        }else{
          extIndex = 0
          thisRes.send('{"status":"ok"}')
        }
    });
}

function _function (p, res, endpoint, params, index, extensionList) {
  var thisIndex = index
  var thisRes = res
  return function (callback) {
    p.get(endpoint, params)
      .then(function(resp){
        var json = resp.json()
        if (json.records.length == 0){
          return callback (null, json);
        }
        let db = new sqlite3.Database(USERS_DATABASE);
        async.each(json.records,
          function(record, callback0){
            var item = {}
            if (record.hasOwnProperty("message") && record.message.type == "VoiceMail"){
              item['type'] = "VM"
              item['id'] = record.message.id
              var recordingUrl = record.message.uri.replace("platform", "media")
              recordingUrl += "/content/" + record.message.id
              item['recordingUrl'] = recordingUrl
            }else if (record.hasOwnProperty("recording")){
              item['type'] = "CR"
              item['id'] = record.recording.id
              item['recordingUrl'] = record.recording.contentUri
            }else {
               return callback0(null, null)
            }

            if (record.hasOwnProperty('from')){
              if (record.from.hasOwnProperty('phoneNumber'))
                item['fromRecipient'] = record.from.phoneNumber
              else if (record.from.hasOwnProperty('name'))
                item['fromRecipient'] = record.from.name
              else
                item['fromRecipient'] = "Unknown #"
            }else{
              item['fromRecipient'] = "Unknown #"
            }
            if (record.hasOwnProperty('to')){
              if (record.to.hasOwnProperty('phoneNumber'))
                item['toRecipient'] = record.to.phoneNumber
              else if (record.to.hasOwnProperty('name'))
                item['toRecipient'] = record.to.name
              else
                item['toRecipient'] = "Unknown #"
            }else{
              item['toRecipient'] = "Unknown #"
            }
            item['date'] = new Date(record.startTime).getTime()
            item['processed'] = 0
            item['rec_id'] = record.id
            item['duration'] = record.duration
            for (var ext of extensionList){
              for (var leg of record.legs){
                if (leg.hasOwnProperty('extension')){
                  if (ext.id == leg.extension.id){
                    item['extensionNum'] = ext.extNum
                    item['fullName'] = ext.fullName
                    break
                  }
                  break
                }
              }
            }
            var query = "INSERT or IGNORE into " + users[index].getUserTable() + " VALUES (" + item['id'] + ",'" + item['rec_id'] + "'," + item['date'] + ",'" + item['type'] + "'," + item['extensionNum'] + ",'" + item['fullName'] + "','" + item['fromRecipient'] + "','" + item['toRecipient'] + "','" + item['recordingUrl'] + "'," + item['duration'] + "," + item['processed']
            query += emptyFields + ")";
            setTimeout(function(){
                db.run(query, function(err, result) {
                  if (err){
                    console.error(err.message);
                  }else{
                    callback0(null, result)
                  }
                })
            }, 1000)
          },
          function (err){
            return callback (null, json);
          })
        })
        .catch(function(e){
          var errorRes = {}
          var err = e.toString();
          if (err.includes("ReadCompanyCallLog")){
            errorRes['calllog_error'] = "You do not have admin role to access account level. You can choose the extension access level."
            thisRes.send(JSON.stringify(errorRes))
          }else{
            errorRes['calllog_error'] = "Cannot access call log."
            thisRes.send(JSON.stringify(errorRes))
          }
          console.log(err)
        })
   }
}

function createTable(table) {
  console.log("createTable: " + table)
  let db = new sqlite3.Database(USERS_DATABASE);
  var query = 'CREATE TABLE '+ table +' (id DOUBLE PRIMARY KEY, rec_id VARCHAR(16) NOT NULL, date INT(11) NOT NULL, type VARCHAR(12) NOT NULL, extensionNum VARCHAR(6) NOT NULL, fullName VARCHAR(32) NOT NULL, fromRecipient VARCHAR(12) NOT NULL, toRecipient VARCHAR(12) NOT NULL, recordingUrl VARCHAR(256) NOT NULL, duration INT DEFAULT 0, processed BOOLEAN NOT NULL, wordswithoffsets TEXT NOT NULL, transcript TEXT NOT NULL, conversations TEXT NOT NULL, sentiment TEXT NOT NULL, sentiment_label VARCHAR(8) NOT NULL, sentiment_score DOUBLE NOT NULL, sentiment_score_hi DOUBLE NOT NULL, sentiment_score_low DOUBLE NOT NULL, actions TEXT NOT NULL, keywords TEXT NOT NULL, entities TEXT NOT NULL, categories TEXT NOT NULL)'
  db.run(query, function(err, result) {
    if (err){
      console.error(err.message);
    }else{
      console.log("table created")
    }
  });

}

function sortDates(a,b) {
  return new Date(b.date) - new Date(a.date);
}

function sortScores(a,b) {
  return b.score - a.score;
}

const randomize = require('randomatic');
function generateRandomCode(digits) {
  var code = randomize('0', digits);
  return code
}
