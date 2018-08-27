function initForReadLog() {
  $( "#fromdatepicker" ).datepicker({ dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  var pastMonth = new Date();
  var day = pastMonth.getDate()
  var month = pastMonth.getMonth() - 1
  var year = pastMonth.getFullYear()
  if (month < 0){
    month = 11
    year -= 1
  }
  $( "#fromdatepicker" ).datepicker('setDate', new Date(year, month, day));
  $( "#todatepicker" ).datepicker('setDate', new Date());
}
function initForRecordedCalls() {
  var sliderPos = document.getElementById("positiveRange");
  sliderPos.oninput = function() {
    var positiveThreshold = this.value/1000;
    $("#posval").html(positiveThreshold)
  }

  var sliderNeg = document.getElementById("negativeRange");
  sliderNeg.oninput = function() {
      var negativeThreshold = (this.value/1000) * -1;
      $("#negval").html(negativeThreshold)
  }
  $("#search").focus()
  $("#search").select()
}
function selectSelectText(){
  $("#search").select()
}
function openAnalyzed(id){
  var formId = "analyzeForm_"+id
  $("#searchWord_" + id).val($("#search").val())
  for (var form of document.forms){
    if (form.id == formId){
      form.submit()
      break
    }
  }
}
function readCallLogs(){
  $("#fromdatepicker").prop("disabled", true);
  $("#todatepicker").prop("disabled", true);
  $("#readcalllogs").prop("disabled", true);
  $("#logginIcon").css('display', 'inline');
  var configs = {}
  configs['dateFrom'] = $("#fromdatepicker").val() + "T00:00:00.001Z"
  configs['dateTo'] = $("#todatepicker").val() + "T23:59:59.999Z"
  var url = "readlogs"
  var posting = $.post( url, configs );
  posting.done(function( response ) {
    var res = JSON.parse(response)
    if (res.status != "ok") {
      alert(res.calllog_error)
    }else{
      window.location = "recordedcalls"
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}

function setSearchFields(elm){
  var opt = $(elm).val()
  if (opt == 'categories'){
    $('#categoryField').css('display', 'inline');
    $('#search').css('display', 'none');
  }else{
    $('#search').css('display', 'inline');
    $('#categoryField').css('display', 'none');
  }
}

function transcribe(audioId, type, recordingUrl){
  $('#te_' + audioId).hide()
  $('#pi_' + audioId).show()
  var configs = {}
  configs['audioSrc'] = audioId
  configs['type'] = type
  if (type == 'VR'){
    recordingUrl = recordingUrl.replace('.mp4', '.mp3')
  }

  configs['recordingUrl'] = recordingUrl
  var url = "transcribe"
  var posting = $.post( url, configs );
  posting.done(function( response ) {
    var res = JSON.parse(response)
    if (res.status == "error") {
      alert(res.calllog_error)
    }else{
      if (res.result.length > 200) {
        res.result = res.result.substring(0, 200)
        res.result += ' ...'
      }
      $('#tt_' + audioId).html(res.result)
      $('#tt_' + audioId).show()
      $('#pi_' + audioId).hide()
      $('#open_' + audioId).show()
      $('#del_' + audioId).show()
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}
function confirmRemove(id){
  var r = confirm("Do you really want to remove this call from local database?");
  if (r == true) {
    removeFromLocalDB(id)
  }
}
function removeFromLocalDB(id){
  var configs = {}
  configs['id'] = id
  var url = "remove"
  var posting = $.post(url, configs)
  posting.done(function(response) {
    var res = JSON.parse(response)
    if (res.status == "error") {
      alert("error")
    }else{
      window.location = "recordedcalls"
    }
  });
  posting.fail(function(response){
    alert(response.statusText)
  });
}

function confirmDelete(id, type, rec_id) {
  var r = confirm("Do you really want to delete this call from RingCentral call log database?");
  if (r == true) {
    deleteFromDB(id, type, rec_id)
  }
}

function deleteFromDB(id, type, rec_id){
  var configs = {}
  configs['id'] = id
  configs['type'] = type
  configs['rec_id'] = rec_id
  var url = "delete"
  var posting = $.post(url, configs)
  posting.done(function(response) {
    var res = JSON.parse(response)
    if (res.status == "error") {
      alert(res.calllog_error)
    }else{
      window.location = "recordedcalls"
    }
  });
  posting.fail(function(response){
    alert(response.statusText)
  });
}
