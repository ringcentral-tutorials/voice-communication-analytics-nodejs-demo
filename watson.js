var watson = require('watson-developer-cloud');
var fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const USERS_DATABASE = './db/users.db';

var haven = require('./hpe');


var speechToText = new watson.SpeechToTextV1({
  username: process.env.WATSON_SPEECHTOTEXT_USERNAME,
  password: process.env.WATSON_SPEECHTOTEXT_PWD,
  url: 'https://stream.watsonplatform.net/speech-to-text/api/'
});

var transcribe = function(table, res, body, bufferStream){
  var thisRes = res
  console.log("transcribing...")
  var thisId = body.audioSrc
  var speakerLabel = true
  var  params = {
      model: 'en-US_NarrowbandModel',
      audio: bufferStream,
      content_type: 'audio/mp3',
      timestamps: true,
      interim_results: false,
      max_alternatives:1,
      profanity_filter: false,
      smart_formatting: true,
      speaker_labels: speakerLabel
    };

  speechToText.recognize(params, function(err, res) {
    if (err)
      console.log(err);
    else{
      var transcript = ""
      if (res.results.length > 0){
        var count = 0
        var speakers = []
        if (speakerLabel){
          count = res.speaker_labels.length
          speakers = res.speaker_labels
        }
        var conversations = []
        var sentence = []
        var index = 0
        var wordArr = []
        var offsetArr = []
        var wordswithoffsets = []
        var addLastSentence = true
        var speakerSentence = {}
        speakerSentence['sentence'] = []
        speakerSentence['timestamp'] = []

        for (var result of res.results){
          var cleanText = result.alternatives[0].transcript.trim()
          if (result.alternatives[0].transcript != " "){
            cleanText = cleanText.charAt(0).toUpperCase() + cleanText.substr(1);
            transcript += cleanText + ". ";
          }
          if (speakerLabel){
            var previousSpeaker = speakers[index].speaker
            addLastSentence = true
            for (var word of result.alternatives[0].timestamps){
              if (word[0] != "%HESITATION"){
                var wordoffset = {}
                wordoffset['word'] = word[0]
                wordoffset['offset'] = word[1]
                wordswithoffsets.push(wordoffset)
                if (index < count){
                  var speakerId = speakers[index].speaker
                  var timeStamp = speakers[index].from
                  var newWord = word[0]
                  index++
                  if (index < count){
                    if (previousSpeaker != speakers[index].speaker){
                      speakerSentence['speakerId'] = speakerId
                      speakerSentence['timestamp'].push(timeStamp)
                      speakerSentence['sentence'].push(newWord)
                      conversations.push(speakerSentence)
                      speakerSentence = {}
                      speakerSentence['sentence'] = []
                      speakerSentence['timestamp'] = []
                      addLastSentence = false
                    }else{
                      addLastSentence = true
                      speakerSentence['speakerId'] = speakerId
                      speakerSentence['timestamp'].push(timeStamp)
                      speakerSentence['sentence'].push(newWord)
                    }
                    previousSpeaker = speakers[index].speaker
                  }else{
                    addLastSentence = true
                    speakerSentence['speakerId'] = speakerId
                    speakerSentence['timestamp'].push(timeStamp)
                    speakerSentence['sentence'].push(newWord)
                  }
                }
              }else{
                index++
              }
            }
          }else{ // just for in case we don't need the speaker label!
            for (var word of result.alternatives[0].timestamps){
              var oriword = word[0]
              if (oriword !=  '%HESITATION'){
                var wordoffset = {}
                wordoffset['word'] = word[0]
                wordoffset['offset'] = word[1]
                wordswithoffsets.push(wordoffset)
                speakerSentence['timestamp'].push(word[1])
                speakerSentence['sentence'].push(oriword)
              }
            }
            conversations.push(speakerSentence)
            speakerSentence = {}
            speakerSentence['sentence'] = []
            speakerSentence['timestamp'] = []
          }
        }
        if (speakerSentence.sentence.length > 0){
          conversations.push(speakerSentence)
        }
        transcript = transcript.replace(/"/, "'")
        transcript = transcript.trim()
        var textWithPunctuation = ""
        var blockTimeStamp = []
        // guess and make artificial puncuation (full stop) base on result sentence
        for (var i=0; i<conversations.length; i++){
          var dialogue = conversations[i]
          var temp = dialogue.sentence.join(" ")
          temp = temp.replace(/\./g, "")
          temp = temp.charAt(0).toUpperCase() + temp.substr(1);
          textWithPunctuation += temp + ". "
          var wArr = temp.split(" ")
          conversations[i].sentence = wArr
          var speaker_timestamp = {}
          speaker_timestamp['speakerId'] = dialogue.speakerId
          speaker_timestamp['timeStamp'] = dialogue.timestamp[0]
          blockTimeStamp.push(speaker_timestamp)
        }
        textWithPunctuation = textWithPunctuation.trim()
        var query = ''
        if (body.type == 'VM')
          query = 'UPDATE ' + table + ' SET wordswithoffsets="' + escape(JSON.stringify(wordswithoffsets)) + '", transcript="' + transcript + '", conversations="' + escape(JSON.stringify(conversations))  + '" WHERE id=' + thisId;
        else
          query = 'UPDATE ' + table + ' SET wordswithoffsets="' + escape(JSON.stringify(wordswithoffsets)) + '", transcript="' + textWithPunctuation + '", conversations="' + escape(JSON.stringify(conversations))  + '" WHERE id=' + thisId;
        let db = new sqlite3.Database(USERS_DATABASE);
        db.run(query, function(err, result) {
          if (err){
            console.error(err.message);
          }
        });

        preAnalyzing(table, blockTimeStamp, textWithPunctuation, transcript, thisId)
        var response = {}
        response['status'] = "ok"
        response['result'] = textWithPunctuation
      }else{
        var response = {}
        response['status'] = "ok"
        response['result'] = "This audio has no voice content!"
      }
      if (thisRes != null)
        thisRes.send(JSON.stringify(response))
    }
  });
}

module.exports.transcribe = transcribe

var nlu = new watson.NaturalLanguageUnderstandingV1({
  "url": "https://gateway.watsonplatform.net/natural-language-understanding/api",
  "username": process.env.WATSON_ANALYTIC_USERNAME,
  "password": process.env.WATSON_ANALYTIC_PWD,
  'version': '2018-03-16'
});


function preAnalyzing(table, blockTimeStamp, text, transcript, thisId){
  var parameters = {
    'text': text,
    'features': {
      'categories': {},
      'keywords': {
        'limit': 100
      }
    }
  }
  nlu.analyze(parameters, function(err, response) {
    if (err)
      console.log('error:', err);
    else{
      haven.hod_sentiment(table, blockTimeStamp, text, response, transcript, thisId)
    }
  });
}
