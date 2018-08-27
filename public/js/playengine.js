window.onload = init;

var aPlayer = null;
var index = 0;
var mIndex = 1;
var wwoArr = []
var occurrencesArr;
var wordElm = null;
var mContent = "";
var searchWordArr = new Array();

var mReference = "";

var speakerSentiment = -1
var foundIndex = 0;
var positiveThreshold = 0.5;
var negativeThreshold = -0.5;

function init() {
  initializeAydioPlayer()

  var h = $(window).height() - 210;

  $("#conversations_block").height(h)
  $("#analytics_block").height(h)

  var sliderPos = document.getElementById("positiveSentimentRange");
  sliderPos.oninput = function() {
    positiveThreshold = this.value/1000;
    $("#posval").html(positiveThreshold)
    displayAnalytics('sentiment')
  }

  var sliderNeg = document.getElementById("negativeSentimentRange");
  sliderNeg.oninput = function() {
      negativeThreshold = (this.value/1000) * -1;
      $("#negval").html(negativeThreshold)
      displayAnalytics('sentiment')
  }
  displayAnalytics('sentiment')
}
function setSpeakersWithSentiment(){
  speakerSentiment = $("#speakers").val()
  displayAnalytics('sentiment')
}
function displayConversations() {
  $("#text_block").hide()
  $("#conversations_block").show()
}
function displayAnalytics(option){
    if (option == 'text'){
      $("#sentiment_adjust").hide()
      var text = "<div>" + window.results.transcript + "</div>"
      $("#analytics_block").html(text)
    }else if (option == 'sentiment'){
      $("#sentiment_adjust").show()
      var itemArr = JSON.parse(window.results.sentiment)
      var text = "<div>"
      if (window.results.type == "VM"){
        var sentence = "<span class='sentiment_line'>" + window.results.transcript + "</span>"
        for (var item of itemArr){
          if (item.hasOwnProperty('positive')){
            for (var pos of item.positive){
              if (pos.score > positiveThreshold){
                var fullStop = window.results.transcript + "."
                if (pos.sentiment == null && pos.topic == null && fullStop == pos.original_text){
                  sentence = "<span class='sentiment_line positive_block'>" + sentence + "</span>"
                }else{
                  var lowerCaseText = pos.original_text.toLowerCase()
                  sentence = sentence.replace(lowerCaseText, "<span class='positive_block'>" + pos.original_text + "</span>")
                }
                if (pos.topic != null){
                  sentence = sentence.replace(pos.topic, "<b>" + pos.topic + "</b>")
                }
                if (pos.sentiment != null){
                  sentence = sentence.replace(pos.sentiment, "<span style='color:#fff624'>" + pos.sentiment + "</span>")
                }
              }
            }
          }
          if (item.hasOwnProperty('negative')){
            for (var neg of item.negative){
              if (neg.score < negativeThreshold){
                var fullStop = window.results.transcript + "."
                if (neg.sentiment == null && neg.topic == null && fullStop == neg.original_text){
                  sentence = "<span class='sentiment_line negative_block'>" + sentence + "</span>"
                }else{
                  var lowerCaseText = neg.original_text.toLowerCase()
                  sentence = sentence.replace(lowerCaseText, "<span class='negative_block'>" + neg.original_text + "</span>")
                }
                if (neg.topic != null)
                  sentence = sentence.replace(neg.topic, "<b>" + neg.topic + "</b>")
                if (neg.sentiment != null)
                  sentence = sentence.replace(neg.sentiment, "<span style='color:#fff624'>" + neg.sentiment + "</span>")
              }
            }
          }
        }
        text += sentence
      }else{ // call recording dialogue
        for (var item of itemArr){
            if (speakerSentiment == -1){

              sentence = '' //item.sentence
              if (item.hasOwnProperty('positive')){
                for (var pos of item.positive){
                  if (pos.score > positiveThreshold){
                    if (sentence == ''){
                      text += "<div class='sentiment_line'><span style='color:orange' onclick='jumpTo(" + item.timeStamp + ")'>Speaker "+ item.speakerId + ": Goto => </span>"
                      sentence = item.sentence
                    }
                    var fullStop = item.sentence + "."
                    if (pos.sentiment == null && pos.topic == null && fullStop == pos.original_text){
                      sentence = "<span class='positive_block'>" + sentence + "</span>"
                    }else{
                      var lowerCaseText = pos.original_text.toLowerCase()
                      sentence = sentence.replace(lowerCaseText, "<span class='positive_block'>" + pos.original_text + "</span>")
                    }
                    if (pos.topic != null)
                      sentence = sentence.replace(pos.topic, "<b>" + pos.topic + "</b>")
                    if (pos.sentiment != null)
                      sentence = sentence.replace(pos.sentiment, "<span style='color:#fff624'>" + pos.sentiment + "</span>")
                  }
                }
              }
              if (item.hasOwnProperty('negative')){
                for (var neg of item.negative){
                  if (neg.score < negativeThreshold){
                    if (sentence == ''){
                      text += "<div class='sentiment_line'><span style='color:orange' onclick='jumpTo(" + item.timeStamp + ")'>Speaker "+ item.speakerId + ": Goto => </span>"
                      sentence = item.sentence
                    }
                    var fullStop = item.sentence + "."
                    if (neg.sentiment == null && neg.topic == null && fullStop == neg.original_text){
                      sentence = "<span class='negative_block'>" + sentence + "</span>"
                    }else{
                      var lowerCaseText = neg.original_text.toLowerCase()
                      sentence = sentence.replace(lowerCaseText, "<span class='negative_block'>" + neg.original_text + "</span>")
                    }
                    if (neg.topic != null)
                      sentence = sentence.replace(neg.topic, "<b>" + neg.topic + "</b>")
                    if (neg.sentiment != null)
                      sentence = sentence.replace(neg.sentiment, "<span style='color:#fff624'>" + neg.sentiment + "</span>")
                  }
                }
              }
              if (sentence != '')
                text += sentence + "</div>"
            }else{ //if (speakerSentiment == 0){
              if (item.speakerId == speakerSentiment){
                sentence = '' //item.sentence
                if (item.hasOwnProperty('positive')){
                  for (var pos of item.positive){
                    if (pos.score > positiveThreshold){
                      if (sentence == ''){
                        text += "<div class='sentiment_line'><span style='color:orange' onclick='jumpTo(" + item.timeStamp + ")'>Speaker "+ item.speakerId + ": Goto => </span>"
                        sentence = item.sentence
                      }
                      var fullStop = item.sentence + "."
                      if (pos.sentiment == null && pos.original_text == null && fullStop == pos.original_text){
                        sentence = "<span class='positive_block'>" + sentence + "</span>"
                      }else{
                        var lowerCaseText = pos.original_text.toLowerCase()
                        sentence = sentence.replace(lowerCaseText, "<span class='positive_block'>" + pos.original_text + "</span>")
                      }
                      if (pos.topic != null)
                        sentence = sentence.replace(pos.topic, "<b>" + pos.topic + "</b>")
                      if (pos.sentiment != null)
                        sentence = sentence.replace(pos.sentiment, "<span style='color:#fff624'>" + pos.sentiment + "</span>")
                    }
                  }
                }
                if (item.hasOwnProperty('negative')){
                  for (var neg of item.negative){
                    if (neg.score < negativeThreshold){
                      if (sentence == ''){
                        text += "<div class='sentiment_line'><span style='color:orange' onclick='jumpTo(" + item.timeStamp + ")'>Speaker "+ item.speakerId + ": Goto => </span>"
                        sentence = item.sentence
                      }
                      var fullStop = item.sentence + "."
                      if (neg.sentiment == null && neg.topic == null && fullStop == neg.original_text){
                        sentence = "<span class='negative_block'>" + sentence + "</span>"
                      }else{
                        var lowerCaseText = neg.original_text.toLowerCase()
                        sentence = sentence.replace(lowerCaseText, "<span class='negative_block'>" + neg.original_text + "</span>")
                      }
                      if (neg.topic != null)
                        sentence = sentence.replace(neg.topic, "<b>" + neg.topic + "</b>")
                      if (neg.sentiment != null)
                        sentence = sentence.replace(neg.sentiment, "<span style='color:#fff624'>" + neg.sentiment + "</span>")
                    }
                  }
                }
                if (sentence != '')
                  text += sentence + "</div>"
              }
            }
        }
      }

      text += "</div>"
      $("#analytics_block").html(text)
    }else if (option == 'entities'){
      $("#sentiment_adjust").hide()
      getInterestsRequestCallback(window.results.entities)
      return
      var entityArr = JSON.parse(window.results.entities)
      var text = "<div>"
      for (var item of entityArr){
        text += "<div>" + item.type + "/" + item.text + "</div>"
      }
      text += "</div>"
      $("#analytics_block").html(text)
    }else if (option == 'keywords'){
      $("#sentiment_adjust").hide()
      var text = "<div>" + window.results.transcript + "</div>"
      var itemArr = JSON.parse(window.results.keywords)
      for (var item of itemArr){
        if (item.text != "class" && item.text != 'keywords'){
        var regEx = new RegExp("\\b" + item.text + "\\b", "g");
        text = text.replace(regEx, "<span class='keywords'>" + item.text + "</span>")
        }
      }
      $("#analytics_block").html(text)
    }else if (option == 'actions'){
      $("#sentiment_adjust").hide()
      var itemArr = JSON.parse(window.results.actions)
      var text = ""
      for (var item of itemArr){
        var upper = item.charAt(0).toUpperCase() + item.substr(1);
        text += "<div>" + upper + "</div>"
      }
      $("#analytics_block").html(text)
    }
}

function initializeAydioPlayer(){
  wwoArr = JSON.parse(window.results.wordswithoffsets)
  wordElm = document.getElementById("word0");
  aPlayer = document.getElementById("audio_player");
  aPlayer.addEventListener("timeupdate",seektimeupdate,false);
  aPlayer.addEventListener('loadeddata', audioLoaded, false);
  aPlayer.addEventListener('seeked', seekEnded, false);
}

function audioLoaded() {
    mIndex = 0;
}
function seekEnded() {
    var pos = aPlayer.currentTime;
    resetReadWords(pos);
    var id = "word" + mIndex;
    wordElm = document.getElementById(id);
}
function seektimeupdate() {
    var pos = aPlayer.currentTime;
    if (mIndex < wwoArr.length)
    {
        var check = wwoArr[mIndex].offset;
        while (pos >= check)
        {
            wordElm.setAttribute("class", "readtext");
            wordElm = document.getElementById("word"+mIndex);
            wordElm.setAttribute("class", "word");
            mIndex++;
            check = wwoArr[mIndex].offset;
        }
    }
}

function resetReadWords(value) {
    var elm;
    for (var i=0; i<mIndex; i++) {
        var idee = "word" + i;
        elm = document.getElementById(idee);
        elm.setAttribute("class", "unreadtext");
    }
    mIndex = 0;
    var pos =  wwoArr[mIndex].offset;
    while (pos < value) {
        var idee = "word" + mIndex;
        elm = document.getElementById(idee);
        elm.setAttribute("class", "readtext");
        mIndex++;
        pos =  wwoArr[mIndex].offset;
    }
}

function searchForText(){
  var searchWord = $("#search").val()
  for (var i=mIndex; i<wwoArr.length; i++){
    var word = wwoArr[i].word
    if (word == searchWord){
      var timeStamp = wwoArr[i].offset
      jumpTo(timeStamp)
      break
    }
  }
  if (i >= wwoArr.length){
    for (var i=0; i<wwoArr.length; i++){
      var word = wwoArr[i].word
      if (word == searchWord){
        var timeStamp = wwoArr[i].offset
        jumpTo(timeStamp)
        break
      }
    }
  }
}

function jumpTo(timeStamp) {
  aPlayer.pause();
  resetReadWords(timeStamp);
  var id = "word" + mIndex;
  wordElm = document.getElementById(id);
  aPlayer.currentTime = timeStamp;
  aPlayer.play();
}

function getInterestsRequestCallback(resp) {
    var data = JSON.parse(resp);
    if (data.length > 0)
    {
        var text = "<div>";
        for (var i=0; i< data.length; i++)
        {
            var entity = data[i];
            if (entity.type == "companies_eng")
            {
                text += "<b>Companiy name: </b><span style=\"color:#01A982 !important\"> " + entity.normalized_text + "</span></br>";
                if (entity.hasOwnProperty('additional_information'))
                {
                    var additional = entity.additional_information;
                    var url = "";
                    if (additional.hasOwnProperty('wikipedia_eng'))
                    {
                        text += "<b>Wiki page: </b><a href=\"";
                        if (additional.wikipedia_eng.indexOf("http") == -1)
                            url = "http://" + additional.wikipedia_eng;
                        else
                            url = additional.wikipedia_eng;
                        text += url + "\">";
                        text += url + "</a>";
                        text += "</br>";
                    }
                    if (additional.hasOwnProperty('url_homepage'))
                    {
                        text += "<b>Home page: </b><a href=\"";
                        if (additional.url_homepage.indexOf("http") == -1)
                            url = "http://" + additional.url_homepage;
                        else
                            url = additional.url_homepage;
                        text += url + "\">";
                        text += url + "</a>";
                        text += "</br>";
                    }
                    if (additional.hasOwnProperty('company_wikipedia'))
                    {
                        var wikiPage = "";
                        for (var p=0; p < additional.company_wikipedia.length; p++)
                            wikiPage += additional.company_wikipedia[p] + ", ";
                        if (wikiPage.length > 3)
                            wikiPage = wikiPage.substring(0, wikiPage.length - 2);
                        text += "<b>Wikipedia:</b> " + wikiPage + "</br>";
                    }
                    if (additional.hasOwnProperty('company_ric'))
                    {
                        var wikiPage = "";
                        for (var p=0; p<additional.company_ric.length; p++)
                            wikiPage += additional.company_ric[p] + ", ";
                        if (wikiPage.length > 3)
                            wikiPage = wikiPage.substring(0, wikiPage.length - 2);
                        text += "<b>RIC:</b> " + wikiPage + "</br>";
                    }
                }
            }
            else if (entity.type == "places_eng")
            {
                text += "<div style=\"color:#01A982 !important\">Place name: " + entity.normalized_text + "</div>";
                if (entity.hasOwnProperty('additional_information')) {
                    var url = "";
                    var additional = entity.additional_information;
                    if (additional.hasOwnProperty('place_population'))
                    {
                        var pop = parseFloat(additional.place_population, 2);
                        var population = numberWithCommas(pop);// pop.toString();
                        /*
                        if (pop > 1000000)
                        {
                            pop /= 1000000;
                            population = pop.toString() + " million";
                        }
                        */

                        text += "<b>Population:</b> " + population + "</br>";
                    }
                    if (additional.hasOwnProperty('image'))
                    {
                        text += "<img src=\"";
                        text += additional.image + "\" width=\"50%\"/>";
                        text += "</br>";
                    }
                    if (additional.hasOwnProperty('wikipedia_eng'))
                    {
                        text += "<b>Wiki page: </b><a target='_blank' href=\"";
                        if (additional.wikipedia_eng.indexOf("http") == -1)
                            url = "http://";
                        else
                            url = additional.wikipedia_eng;
                        text += url + "\">";
                        text += url + "</a>";
                        text += "</br>";
                    }
                    if (additional.lat != 0.0 && additional.lon != 0.0)
                    {
                        var zoom = "10z";
                        if (additional.hasOwnProperty('place_type'))
                        {
                            switch (additional.place_type)
                            {
                                case "region1":
                                    zoom = ",6z";
                                    break;
                                case "continent":
                                    zoom = ",5z";
                                    break;
                                case "area":
                                    zoom = ",7z";
                                    break;
                                case "country":
                                    zoom = ",4z";
                                    break;
                                case "populated place":
                                    zoom = ",10z";
                                    break;
                                default:
                                    zoom = ",12z";
                                    break;
                            }
                        }
                        text += "<b>Map: </b><a target='_blank' href=\"https://www.google.com/maps/@" + additional.lat + "," + additional.lon + zoom + "\">";
                        text += "Show map</a></br>";
                    }
                }
            }
            else if (entity.type == "people_eng")
            {
                text += "<div style=\"color:#01A982 !important\">People name: " + entity.normalized_text + "</div>";

                if (entity.hasOwnProperty('additional_information'))
                {
                    var additional = entity.additional_information;
                    if (additional.hasOwnProperty('person_profession'))
                    {
                        var prof = "";
                        for (var p=0; p < additional.person_profession.length; p++)
                            prof += additional.person_profession[p] + ", ";
                        if (prof.length > 3)
                            prof = prof.substring(0, prof.length - 2);
                        text += "<b>Profession:</b> " + prof + "</br>";
                    }
                    if (additional.hasOwnProperty('person_date_of_birth'))
                        text += "<b>DoB:</b> " + additional.person_date_of_birth + "</br>";
                    if (additional.hasOwnProperty('person_date_of_death'))
                        text += "<b>DoD:</b> " + additional.person_date_of_death + "</br>";
                    if (additional.hasOwnProperty('image'))
                    {
                        text += "<img src=\"";
                        text += additional.image + "\" width=\"50%\"/>";
                        text += "</br>";
                    }
                    if (additional.hasOwnProperty('wikipedia_eng'))
                    {
                        var url = "";
                        text += "<b>Wiki page: </b><a href=\"";
                        if (additional.wikipedia_eng.indexOf("http") == -1)
                            url = "http://";
                        else
                            url = additional.wikipedia_eng;
                        text += url + "\">";
                        text += url + "</a>";
                        text += "</br>";
                    }
                }
            }
            else if (entity.type == "drugs_eng")
            {
                text += "<div style=\"color:#01A982 !important\">Drugs: " + entity.original_text + "</div>";
                if (entity.hasOwnProperty('additional_information')) {
                    var additional = entity.additional_information;
                    if (additional.hasOwnProperty('wikipedia_eng')) {
                        var url = "";
                        text += "<b>Wiki page: </b><a href=\"";
                        if (additional.wikipedia_eng.indexOf("http") == -1)
                            url = "http://";
                        else
                            url = additional.wikipedia_eng;
                        text += url + "\">";
                        text += url + "</a>";
                        text += "</br>";
                    }
                    if (additional.hasOwnProperty('disease_icd10')) {
                        var temp = "";
                        for (var p = 0; p < additional.disease_icd10.length; p++)
                            temp += additional.disease_icd10[p] + ", ";
                        if (temp.length > 3)
                            temp = temp.substring(0, temp.length - 2);
                        text += "<b>Disease:</b> " + temp + "</br>";
                    }
                }
            } else if (entity.type == "medical_conditions") {
                text += "<div style=\"color:#01A982 !important\">Medical condition: " + entity.original_text + "</div>";
                if (entity.hasOwnProperty('additional_information')) {
                    var additional = entity.additional_information;
                    if (additional.hasOwnProperty('wikipedia_eng')) {
                        var url = "";
                        text += "<b>Wiki page: </b><a target='_blank' href=\"";
                        if (additional.wikipedia_eng.indexOf("http") == -1)
                            url = "http://";
                        else
                            url = additional.wikipedia_eng;
                        text += url + "\">";
                        text += url + "</a>";
                        text += "</br>";
                    }
                    if (additional.hasOwnProperty('disease_icd10')) {
                        for (var p = 0; p < additional.disease_icd10.length; p++) {
                            text += "<b>ICD-10: </b><a target='_blank' href=\"";
                            text += additional.disease_icd10[p] + "\">";
                            text += "link</a>";
                            text += "</br>";
                        }
                    }
                }
            }
            text += "<br/>";
        }
        text += "</div>";
        $('#analytics_block').html(text);
    }
}
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
