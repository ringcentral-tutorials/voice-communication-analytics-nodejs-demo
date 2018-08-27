var havenondemand = require('havenondemand')
var hodClient = new havenondemand.HODClient(process.env.HOD_APIKEY, "v2")
const sqlite3 = require('sqlite3').verbose();
const USERS_DATABASE = './db/users.db';
const positiveSentimentAlertLimit = 0.4
const negativeSentimentAlertLimit = -0.4
var callActionDictionary = ['my number is', 'my cell phone is', 'my cell number is', 'my phone number is', 'call me back', 'give me a call', 'ring me back', 'give me a call', 'reach me at']

module.exports.hod_sentiment = function(table, blockTimeStamp, text, input, transcript, id){
  var thisId = id
  var data = {}
  data['keywords'] = escape(JSON.stringify(input.keywords))
  var categories = []
  input.categories.forEach(category => {
    if (category.score > 0.2)
      categories.push(category.label)
  });
  if (categories.length == 0)
    categories.push('Unclassified')
  input['categories'] = categories
  data['categories'] = escape(JSON.stringify(categories))

  var textArr = text.split(".")
  for (var i=0; i<textArr.length; i++)
    textArr[i] = textArr[i].trim()
  var request = {'text' : textArr}
  hodClient.get('analyzesentiment', request, false, function(err, resp, body) {
    if (!err) {
        var results = []
        var count = 0
        var score = 0
        var num = 0
        var hi = 0
        var low = 0
        for (var sentence of resp.body.sentiment_analysis){
          if (sentence.aggregate.score != 0){
            if (count < blockTimeStamp.length){
              sentence['timeStamp'] = blockTimeStamp[count].timeStamp
              sentence['speakerId'] = blockTimeStamp[count].speakerId
            }
            sentence['sentence'] = textArr[count]
            sentence['sentiment_label'] = sentence.aggregate.sentiment
            sentence['sentiment_score'] = sentence.aggregate.score
            for (var pos of sentence.positive){
              if (pos.score > hi)
                hi = pos.score
              score += pos.score
              num++
            }
            for (var neg of sentence.negative){
              if (neg.score < low)
                low = neg.score
              score += neg.score
              num++
            }
            results.push(sentence)
          }else{
            console.log(textArr[count])
          }
          count++
        }

        var average = score/num
        //console.log("SCORE :" + average)
        if (average > positiveSentimentAlertLimit)
          data['sentiment_label'] = "positive"
        else if (average < negativeSentimentAlertLimit)
          data['sentiment_label'] = "negative"
        else
          data['sentiment_label'] = "neutral"
        data['sentiment_score'] = score
        data['sentiment_score_hi'] = hi
        data['sentiment_score_low'] = low
        data['sentiment'] = results

        // read entitis extraction
        var actionTranscript = transcript
        for (var term of callActionDictionary){
          var regExp = new RegExp("\\b" + term + "\\b", "ig");
          if (actionTranscript.match(regExp) != null){
            actionTranscript = actionTranscript.replace(regExp, '<span style="font-size: 1.4em; color:#fff624">' + term + "</span>")
          }
        }
        var entityType = ['people_eng','places_eng','companies_eng','professions_eng','profanities','professions','number_phone_us', 'pii', 'pii_ext', 'address_us', 'address_ca', 'date_eng']
        var request = {'text' : transcript,
                        'entity_type' : entityType,
                        'show_alternatives': false
                      }
        hodClient.get('extractentities', request, false, function(err, resp, body) {
          if (!err) {
            var actions = []
            var phoneNumbers = []

            for (var entity of resp.body.entities){
              if (entity.type == "number_phone_us"){
                  var newNumber = true
                  for (var number of phoneNumbers){
                    if (number == entity.normalized_text){
                      newNumber = false
                      break
                    }
                  }
                  if (newNumber)
                    phoneNumbers.push(entity.normalized_text)
              }
            }
            for (var number of phoneNumbers){
              var regExp = new RegExp("\\b" + number + "\\b", "ig")
              if (actionTranscript.match(regExp) != null){
                actionTranscript = actionTranscript.replace(regExp, '<a href="rcmobile://call?number=' + number + '">' + number + '</a>')
                console.log(actionTranscript)
              }
            }
            actions.push(actionTranscript)
            //console.log("action: " + transcript)
            var query = "UPDATE " + table + " SET processed=1"
            query += ', sentiment="' + escape(JSON.stringify(results)) + '"'
            query += ', sentiment_label="' + data.sentiment_label + '"'
            query += ', sentiment_score=' + data.sentiment_score
            query += ', sentiment_score_hi=' + data.sentiment_score_hi
            query += ', sentiment_score_low=' + data.sentiment_score_low
            query += ', actions="' + escape(JSON.stringify(actions)) + '"'
            query += ', keywords="' + data.keywords + '"'
            query += ', entities="' + escape(JSON.stringify(resp.body.entities)) + '"'
            query += ', categories="' + data.categories + '"'
            query += ' WHERE id=' + thisId;
            let db = new sqlite3.Database(USERS_DATABASE);
            db.run(query, function(err, result) {
              if (err){
                console.error(err.message);
              }
            });
          }
        })
    }else{
      console.log("ERROR: " + err)
    }
  })
}
