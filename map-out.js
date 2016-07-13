$(function(){
 var leftBar = $('#sidebar');
 leftBar.setSize($('#map-wrapper'), $('#show-events'), '');
 $(window).resize(function(){
   leftBar.setSize($('#map-wrapper'), $('#show-events'), '');
 });
 //sidebar height
 var showEventsH = $('#show-events').height();
 //limit sidebar links
 var linkLimit = Math.round(showEventsH / 33);

 var constants = {
   'DEFAULT_LOC': 'address, city, zip or event name',   
   'DEFAULT_CAT': 'all events',
   'DEFAULT_DATE': 'when',
   'MAP_DRAGGED': 'q=dragged'
 };
 
 var boundaryLine, hash;
 var firstLoad = true;
 var markers = new Array();
 var noResult = $('#dialog-result');
 var pbar = $("#progress");
 var mapProgress = $("#map-prog #bar");
 var progInfo = $('#p-info')
 var disableMap = $('#disable-map');
 var popUp = $('#dialog-modal');
 var selectCat = $('#select-category');
 var catBox = $('#category-box');
 var newCity = $('#add-new-city');
 var eventBox = $('#event-box');
 var locInput = $('#location');
 var calendar = $('#allevents .datepicker');
 var currentDate = calendar.val(); 
 var eid=0;
 var p=0;
 var field = new Array();
 var images = new Array();
 var zep = $('#zeppelin');
 var signin = $('#signin');
 $('.datepicker').datepicker({minDate: 0});
 var options = mapOptions();
 var styles = mapStyles();
 var map = new google.maps.Map(document.getElementById('map'), options);
 map.setOptions({styles: styles});
 
 if (google.loader.ClientLocation) {
	 if (google.loader.ClientLocation.latitude && google.loader.ClientLocation.longitude) {
	  var latLng = new google.maps.LatLng(google.loader.ClientLocation.latitude, 
				   google.loader.ClientLocation.longitude);
	  var userLoc = 'You are located in '
	  userLoc += google.loader.ClientLocation.address.city + ', '; 
	  userLoc += google.loader.ClientLocation.address.country; 
	 } 
	 else {
	  var userLoc = '';
	 }
 }
 
 $(window).on('hashchange.namespace', function(event){
     hash = window.location.hash.substring(3);
     //get first occurrence of &
     var queryEnd = hash.indexOf('&');
     var readBounds = [];
     var cnt = 0;
     var dragMap = false;
     //if no category or date, read after # as query
     if(queryEnd == -1){
         var currentLoc = hash.replace('+', ' ');
         locInput.val(currentLoc);
         selectCat.text(constants.DEFAULT_CAT);
     }
     else{
         var getQuery = hash.substring(0, queryEnd);
         var currentLoc = getQuery == 'dragged' ? constants.DEFAULT_LOC : getQuery.replace('+', ' ');
	     locInput.val(currentLoc);
         var pairs = hash.split('&');
         var getCat = constants.DEFAULT_CAT;
         var getDate = constants.DEFAULT_DATE;
         var values = new Array();
         for(var i = 0; i < pairs.length; i++){
            var pos = pairs[i].indexOf('=');
            if (pos == -1) continue;
            values[i] = pairs[i].substring(pos+1);
            if(pairs[i] == 'category='+values[i]) getCat = values[i];
            if(pairs[i] == 'when='+values[i]) getDate = values[i];
            if(pairs[i] == 'SW='+values[i] || pairs[i] == 'NE='+values[i]){
              readBounds[cnt] = values[i];
              cnt++;
              dragMap = true;
            }
         }
         selectCat.text(getCat);
         calendar.val(getDate);
     }
     if(jQuery.trim(hash).length > 2){
         ajaxSearch('q='+hash, currentLoc, readBounds, dragMap);
     }
     else{
         window.location = 'home';
     }
 });
 $(window).triggerHandler('hashchange.namespace');
 
/*----------------------------------------Main Search-----------------------------------*/

var oldLoc = oldHash = '';
function ajaxSearch(q, location, bArray, drag){
 var i = 0;
 var getCoord = new Array();
 var events = new Array();
 var outer = 0;
 var inner = 0;
 var bounds = new google.maps.LatLngBounds();
 if(!drag){
 $.ajax({
   type: 'GET',
   url: 'getBounds', 
   data: q+'&limit='+linkLimit,
   dataType:'json',
   success: function(data){
 if(data == 0){
   //if city doesn't exist bring pop-up dialog
   showDialog(newCity, q, oldHash);
 }
 else{
   if(oldLoc != location){
	 $.each(data, function(index, value){
	   getCoord[i] = value;
        i++;
	 });
    var boundSize = getCoord.length;
  	for(var a=0;a<boundSize;a++){
		   var pos = getCoord[a].split(',');
		   var latLng = new google.maps.LatLng(pos[0],pos[1]);
		   bounds.extend(latLng);
		   map.fitBounds(bounds);
	}
	//if only one event don't bound the map
	if(boundSize <= 2){
	    map.setZoom(12);
	}
	oldLoc = location;
   }
   $.ajax({
	   type: 'GET',
	   url: 'findEvents', //send to PHP to process search
	   data: q+'&limit='+linkLimit, //query
	   dataType:'json', //get data in json format from search file
	   success: function(data){
	   if(data == 0){
		  //if city doesn't exist bring pop-up dialog
		  showDialog(newCity, q, oldHash);
		}
		else{
		 $('#tabs').show();
		 oldHash = q;
		 var events = new Array();
		 var outer = 0;
		 var inner = 0;
		 /*use jquery $.each to iterate thru data and store it in multidimensional array
		   there are 5 elements returned from search file: id, category, title, latitude & longtitude.
		   (e.g. events[0][0] => id, events[0][1] => title, ... 
				 events[1][0] => next id, events[1][1] => next title, etc */
		 $.each(data, function() {
			events[outer] = new Array();
			$.each(this, function(index, value){
			  events[outer][inner] = value;
			  inner++;
			});
			outer++;
			inner=0;
		 });
         displayEvents(events);
        }
       },
	   error:function(XMLHttpRequest, textStatus, errorThrown){
		 alert(errorThrown);
	   }
	 });       
   }
  }
 });
 }
 else{
  if(firstLoad){
	  var sWest = bArray[0].replace(':', ',');
	  var nEast = bArray[1].replace(':', ',');
	  var sPos = sWest.split(',');
	  var nPos = nEast.split(',');
	  var coordArray = [sWest, nEast];
	  for(var i=0;i<coordArray.length;i++){
		   var coord = coordArray[i].split(',');
		   var latLng = new google.maps.LatLng(coord[0],coord[1]);
		   bounds.extend(latLng);
		   map.fitBounds(bounds);
	   }
  }
  oldLoc = '';
  changedBounds(q);
 }
}

function changedBounds(query){
   var newCoord = new Array();
   var newEvents = new Array();
   var outer = 0;
   var inner = 0;
   $.ajax({
	   type: 'GET',
	   url: 'findEvents', 
	   data: query,
	   dataType:'json',
	   success: function(data){
		if(data == 0){
		  //remove previous search results display
		  $('#show-events #result').remove();
		  clearMarkers();
		  $.each($('#show-events .event-link'),function(){
			$(this).remove();
		  });
		   var found = $(document.createElement('p'));
		   found.attr('id','result').text('No events here...').appendTo($('#show-events'));
		 }
		else{
		  var i = 0;
		  $.each(data, function() {
			newEvents[outer] = new Array();
			$.each(this, function(index, value){
			  newEvents[outer][inner] = value;
			  inner++;
			});
			 outer++;
			 inner=0;
		  });
		  //var zoomNum = map.getZoom();
		  //map.setZoom(zoomNum);
		  displayEvents(newEvents);
		 }
	   },
	   error:function(XMLHttpRequest, textStatus, errorThrown){
		alert(errorThrown);
	   }
   });
 }
 
 ////////////////////////////////////Geolocation//////////////////////////////////////////
 $('#closest').click(function(event){
   if(event.preventDefault){
        event.preventDefault();
    }else{
        event.returnValue = false; 
    };
    $.each($('#search-filter a'),function(){
		$(this).css({'background-position':'0','color':'#666'});
	});
    $(this).css({'background-position':'-100px','color':'#fff'});
	//determine if the handset has client side geo location capabilities
	if(geo_position_js.init()){
		  var settings = {
			enableHighAccuracy: true
		  };
		  geo_position_js.getCurrentPosition(setPosition, handleError, settings);
	} 
	else {
		  alert('Geo functionality is not available');
	}

  function handleError(error) {
    alert('Error = ' + error.message);  
  }
  
  function setPosition(position) {
   var latLng = new google.maps.LatLng(position.coords.latitude,      
                     position.coords.longitude);
   //var latLng  = 37.79766 +','+-122.406247;
   var c = String(latLng);
   c = c.replace(/[\(\)]/g, '');
   var newCenter = c.split(',');
   var cLat = parseFloat(newCenter[0]);
   var cLng = parseFloat(newCenter[1]);
   cLat = Math.round(cLat * 1000000)/1000000;
   cLng = Math.round(cLng * 1000000)/1000000;
   var newCoord = new Array();
   var newEvents = new Array();
   var outer = 0;
   var inner = 0;
   $.ajax({
	   type: 'GET',
	   url: 'nearLoc', 
	   data: 'lat='+cLat+'&lng='+cLng+'&limit='+linkLimit,
	   dataType:'json',
	   success: function(data){
		if(data == 0){
		  alert('Sorry, we have no events near you');
		 }
		else{
		  var i = 0;
		  $.each(data, function() {
            newEvents[outer] = new Array();
			$.each(this, function(index, value){
			  newEvents[outer][inner] = value;
			  inner++;
			});
		     outer++;
		     inner=0;
		  });
		  displayEvents(newEvents);
		 }
	   },
       error:function(XMLHttpRequest, textStatus, errorThrown){
        alert(errorThrown);
       }
   });
  }
});

$('#popular').click(function(event){
 event.preventDefault();
});

$('#latest').click(function(event){
 event.preventDefault();
});
 
 /*---------------------------------------------------------------------------------------
 ////////////////////////////////////MAP EVENTS///////////////////////////////////////////
 ---------------------------------------------------------------------------------------*/

 google.maps.event.addListener(map, 'dragend', function(){
   var b = map.getBounds();
   //min
   var sWest = b.getSouthWest();
   //max
   var nEast = b.getNorthEast();
   var southWest = Math.round(sWest.lat() * 1000000)/1000000 +':'+ Math.round(sWest.lng() * 1000000)/1000000;
   var northEast = Math.round(nEast.lat() * 1000000)/1000000 +':'+ Math.round(nEast.lng() * 1000000)/1000000;
   var cat = selectCat.text();
   var date = calendar.val();
   locInput.val('address, city, zip or event name');
   if(cat == constants.DEFAULT_CAT && date == constants.DEFAULT_DATE){
      window.location.hash = constants.MAP_DRAGGED+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
   }
   else if(cat != constants.DEFAULT_CAT && date == constants.DEFAULT_DATE){
      window.location.hash = constants.MAP_DRAGGED+'&category='+cat+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
   }
   else if(cat == constants.DEFAULT_CAT && date != constants.DEFAULT_DATE){
      window.location.hash = constants.MAP_DRAGGED+'&when='+date+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
   }
   else{
      window.location.hash = constants.MAP_DRAGGED+'&category='+cat+'&when='+date+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
   }
 });
 	   
 google.maps.event.addListener(map, 'zoom_changed', function(){
   var zoomNum = map.getZoom(); 
   if(zoomNum < 4) map.setZoom(4);
   if(zoomNum > 20) map.setZoom(20);
   /*var b = map.getBounds();
   //min
   var sWest = b.getSouthWest();
   //max
   var nEast = b.getNorthEast();
   var southWest = Math.round(sWest.lat() * 1000000)/1000000 +':'+ Math.round(sWest.lng() * 1000000)/1000000;
   var northEast = Math.round(nEast.lat() * 1000000)/1000000 +':'+ Math.round(nEast.lng() * 1000000)/1000000;
   var cat = selectCat.text();
   var date = calendar.val();
   var getLoc = locInput.val();
   var loc = getLoc.replace(' ', '+');
	   var newCoord = new Array();
	   var newEvents = new Array();
	   var outer = 0;
	   var inner = 0;
	   /*$.ajax({
		   type: 'GET',
		   url: 'newBounds', 
		   data: 'lat='+cLat+'&lng='+cLng+'&limit='+linkLimit,
		   dataType:'json',
		   success: function(data){
			if(data == 0){
			  
			 }
			else{
			  var i = 0;
			  $.each(data, function() {
				newEvents[outer] = new Array();
				$.each(this, function(index, value){
				  newEvents[outer][inner] = value;
				  inner++;
				});
				 outer++;
				 inner=0;
			  });
			  displayEvents(newEvents, true);
			 }
		   },
		   error:function(XMLHttpRequest, textStatus, errorThrown){
			alert(errorThrown);
		   }
	   });*/
  });
 
 $('#show-events .event-link a').click(function(){
  var linkId = this.id;
  var fieldId = new Array();
  $.each($('#event-info .heading'),function(){
      fieldId.push(this.id);
  });
  showEvent(fieldId, linkId);
  return false;
 });

////////////////////////////////////////////////////////////////////////////////////////////////////    
/*----------------------------------------Top Main Search-----------------------------------------*/
////////////////////////////////////////////////////////////////////////////////////////////////////

$('#allevents .go-search').click(function(event){
 event.preventDefault();
 var loc = locInput.val();
 var cat = selectCat.text();
 var when = calendar.val();
 hideEventBox();
 if(jQuery.trim(loc).length > 2 && loc != constants.DEFAULT_LOC){
   if(jQuery.trim(cat).length == 0 || cat == constants.DEFAULT_CAT){
     var query = 'q='+loc.toLowerCase().replace(' ', '+');
     window.location.hash = query;
   }
   else {
     var query = 'q='+loc.toLowerCase().replace(' ', '+')
                  + '&category='+cat.toLowerCase().replace(' ', '+');
     window.location.hash = query;
   }
 }
});

selectCat.click(function(){
  if(catBox.is(':hidden')){
    $(this).css({'border' : '1px solid #00A9FC'});
    catBox.fadeIn();
  }
  else{
    catBox.fadeOut();
    $(this).css({'border' : '1px solid #D0DADD'});
  }
  if(!eventBox.is(':hidden')){
   hideEventBox();
  }
  return false;
});

$("body").click(function (evt) {
  var target = evt.target;
  if(target.id !== 'category-box'){
     catBox.hide();
     selectCat.css({'border' : '1px solid #D0DADD'});
  }
});

$('#category-box a').click(function(){
  var loc = locInput.val();
  var cat = this.id;
  var date = calendar.val();
  var firstParam = hash.indexOf('&');
  var isDragged = hash.substring(0, firstParam);
   catBox.hide('fast', function(){
     selectCat
       .css({'border' : '1px solid #D0DADD'})
       .text(cat);
   });
   hideEventBox();
   //boundaryLine.setMap(null);
  if(isDragged == 'dragged'){
    var values = new Array();
    var pairs = hash.split("&");
	 for(var i = 0; i < pairs.length; i++){
		var pos = pairs[i].indexOf('=');
		if (pos == -1) continue;
		values[i] = pairs[i].substring(pos+1);
		if(pairs[i] == 'SW='+values[i]) southWest = values[i];
		if(pairs[i] == 'NE='+values[i]) northEast = values[i];
	}
		if(cat == constants.DEFAULT_CAT && date == constants.DEFAULT_DATE){
           window.location.hash = constants.MAP_DRAGGED+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
	    }
	    else if(cat != constants.DEFAULT_CAT && date == constants.DEFAULT_DATE){
		   window.location.hash = constants.MAP_DRAGGED+'&category='+cat+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
	    }
	    else if(cat == constants.DEFAULT_CAT && date != constants.DEFAULT_DATE){
		   window.location.hash = constants.MAP_DRAGGED+'&when='+date+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
	    }
	    else{
		  window.location.hash = constants.MAP_DRAGGED+'&category='+cat+'&when='+date+'&SW='+southWest+'&NE='+northEast+'&limit='+linkLimit;
	    }
  }
  else{
	  if(jQuery.trim(loc).length > 2){
	   if(jQuery.trim(cat).length == 0 || cat == constants.DEFAULT_CAT){
		 var query = 'q='+loc.toLowerCase().replace(' ', '+');
	   }
	   else{
		 var query = 'q='+loc.toLowerCase().replace(' ', '+')
					  + '&category='+cat.toLowerCase();
	   }
	   window.location.hash = query;
   }
  }
 return false;
});

 $('#signin').click(function(){
   window.location = 'signin?q='+hash;
   return false;
 });

function displayEvents(events){
	 var bCoord = new Array();
	 var linkId = 0;
	 //remove previous search results display
	 clearMarkers();
	 $.each($('#show-events .event-link'),function(){
		$(this).remove();
	 });
	 //get new data from events array
	 var odd = 1;
	 mapProgress.progressbar({ 'value': 0 });
	 var eSize = events.length; 
	 $('#show-events #result').remove();
	 var found = $(document.createElement('p'));
	 found.attr('id','result').text('Showing '+eSize+' events').appendTo($('#show-events'));
	 for(var j=0;j<eSize;j++){
	  //create new html elements for for displaying new search results
	  var eventUL = $(document.createElement('ul'));
	  eventUL.attr('class', 'event-link');
	  var eventLI = $(document.createElement('li'));
	  eventLI.appendTo(eventUL);
	  var eventLink = $(document.createElement('a'));
	  //make stripes
	  var bkg = odd%2 == 0 ? 'highlight' : 'clear';
	  var title = events[j][1];
	  //shorten event name if it's longer than 20 chars
	  if(events[j][1].length > 30){
	    title = events[j][1].substr(0, 30);
	    var pos = strrpos(title, ' ');
        if (pos == false) return false;
         title = title.substring(0, pos + 1)+'...';
      }
	  events[j][7] = events[j][7].replace(/\s+/g, '').replace(/&amp;/g, '&');
	  eventLink
		.css({'background-image' : 'url(images/marker/'+events[j][7]+'.png)', 
			  'background-position' : 'left center', 'background-repeat' : 'no-repeat'})
		.attr('id', events[j][0])
		.attr('class', bkg)
		.attr('href', '#')
		.attr('title', events[j][1])
		.html(title);
	  eventLink.appendTo(eventLI);
	  eventUL.appendTo($('#show-events'));
	  odd++;
	  (function(){
		  var i = j;
		  bCoord[i] = new google.maps.LatLng(events[i][2] , events[i][3]);
		  //get latitude and longtitude for each marker
		  var pos = new google.maps.LatLng(events[i][2] , events[i][3]);
		  //load new map with new data. events[i][1] => title, events[i][2] => title, events[i][0] => marker id
		  setTimeout(function(){
			loadMap(eSize, events[i][7], pos, events[i][1], events[i][0]);
		  }, i * 10);
	  })();
	 }
	 /*boundaryLine = new google.maps.Polygon({
		   paths: bCoord,
		   strokeColor: "#00A9FC",
		   strokeOpacity: 1,
		   strokeWeight: 2,
		   fillOpacity: 0
	 });
	 boundaryLine.setMap(map);*/
	 $('#search-filter').show();
	 $('#search-filter #latest').attr('class','check');
	 $('#allevents').show();
	 
	 /*$('#e-pagination').remove();
	 var pagination = $(document.createElement('div'));
	 pagination
	   .attr('id', 'e-pagination');
	 var pagUL = $(document.createElement('ul'));
	 for(var l=1;l<4;l++){
		var pagLI = $(document.createElement('li'));
		var pagLink = $(document.createElement('a'));
		pagLink.attr('href','#').text(l).appendTo(pagLI);
		pagLI.appendTo(pagUL);
	 }
	 pagUL.appendTo(pagination);
	 pagination.appendTo($('#show-events'));
	 $('#e-pagination a').click(function(event){
	   event.preventDefault();
	 });*/
	
	  //open info box for each link
	 $('#show-events .event-link a').click(function(){
		  $.each($('#show-events .event-link a'),function(o){
			 var eBkg = o%2 == 0 ? '#f0f0f0' : '#fff';
			 $(this).css('background-color', eBkg);
			 o++;
		  });
		  linkId = this.id;
		  var fieldId = new Array();
		  $.each($('#event-info .heading'),function(){
			fieldId.push(this.id);
		  });
		  $(this).css({'background-color' : '#ADD8E6'});
		  if(!catBox.is(':hidden')){
			catBox.hide();
			selectCat.css({'border' : '1px solid #D0DADD'});
		  }
		  //position event box @ sidebar event link height
		  var halfH = showEventsH / 2 + 60;
		  var boxTop = $(this).position();
		  if(halfH > boxTop.top){
		     var setTop = boxTop.top - 21;
		     $('#arrow').css({'top' : '20px'}); 
		  }
		  else{
		     var setTop = boxTop.top - 140;	
		     $('#arrow').css({'top' : '140px'});	  
		  }
		  eventBox.css({'top' : setTop});
		  
		  showEvent(fieldId, linkId);
		  
		  for(s in markers){
			markers[s].setAnimation(null);
			if(markers[s].id == linkId){
			   markers[s].setAnimation(google.maps.Animation.BOUNCE);
			}
		  }
		 return false;
	 });
	
	 $.each($('#show-events .event-link a'),function(index){
		 var bkg = index%2 == 0 ? '#f0f0f0' : '#fff';
		 $(this).css('background-color', bkg);
		 $(this).mouseover(function(){
		   $(this).css('background-color' , '#ADD8E6');
		 });
		 $(this).mouseout(function(){
		  if(linkId == this.id){
			$(this).css('background-color' , '#ADD8E6');
		   }
		   else{
			$(this).css('background-color', bkg);
		   }
		 });
		 index++;
	 });
	   
	 google.maps.event.addListener(map, 'bounds_changed', function(){
		  hideEventBox();
		  linkId=0;
		  markerStopAnim();
		  $.each($('#show-events .event-link a'),function(o){
			 var eBkg = o%2 == 0 ? '#f0f0f0' : '#fff';
			 $(this).css('background-color', eBkg);
			 o++;
		  });
	  });
	   
	 google.maps.event.addListener(map, 'click', function(){
		  hideEventBox();
		  linkId=0;
		  markerStopAnim();
		  $.each($('#show-events .event-link a'),function(o){
			 var eBkg = o%2 == 0 ? '#f0f0f0' : '#fff';
			 $(this).css('background-color', eBkg);
			 o++;
		  });
	 }); 
}

/*-------------------------------------Search Dialog------------------------------------*/

function showDialog(element, query, oldUrl){
 progInfo.hide();
 noResult.show();
 var q = query.substring(2);
 $('#no-result').text('We got nothing for '+q);
 popUp.dialog({
   width: 400,
   modal: true
 });

 $('#another-search').click(function(){
   element.hide();
   popUp.dialog('close');
   if($('#allevents').is(':hidden')){
     window.location = 'home';
  }
  else{
   window.location.hash = oldUrl;
  }
   return false;
 });
}

 function showEvent(fieldId, linkId){
 var i = 0;
 $.ajax({
    type: 'GET',
    url: 'getEvent',
    data: 'id='+encodeURIComponent(linkId),
    dataType:'json',
    success: function(data){
        $.each(data, function() {
          $.each(this, function(index, value) {
             if(fieldId[i] == 'e-title' ){
               $('#'+fieldId[i]).html(value);
             }
             else if(fieldId[i] == 'e-user' ){
               $('#'+fieldId[i]).html('<strong>by:</strong> '+value);
             }
             else if(fieldId[i] == 'description'){
               var pos = strrpos(value, ' ');
               if (pos == false) return false;
               value = value.substring(0, pos + 1);
               value = nl2br(value, false);
               value = value+'... <a href=#more id=more-desc>more</a>';
               $('#'+fieldId[i]).html('<strong>'+fieldId[i]+'</strong>' + ': ' + value);
             }
             else{
               $('#'+fieldId[i]).html('<strong>'+fieldId[i]+'</strong>' + ': ' + value);
             }
             $('#more-desc').click(function(e){
               e.preventDefault();
               hideEventBox();
             });
             i++;
          });
        });
        if(eventBox.is(':hidden')) {
          eventBox.show();
        }
     }
  });
 }  
 
 function hideEventBox(){
  if(!eventBox.is(':hidden')) {
     eventBox.hide();
  }
 }
 
 $('#close-event').click(function(event){
  event.preventDefault();
  markerStopAnim();
  hideEventBox();
 });
 
////////////////////////////////////////////////////////////////////////////////////////// 
/*----------------------------------------MAP-------------------------------------------*/
////////////////////////////////////////////////////////////////////////////////////////// 
    
 function mapOptions(){
  var options = {
     disableDefaultUI: true,
     zoomControl: true,
     zoomControlOptions: {
     style: google.maps.ZoomControlStyle.SMALL,
     position: google.maps.ControlPosition.RIGHT_TOP
     },
     streetViewControl: false,
     mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    return options;
 }
 
 function singleOptions(lat, lng){
  var options = {
     zoom: 13,
     center: new google.maps.LatLng(lat, lng),
     disableDefaultUI: true,
     zoomControl: true,
     zoomControlOptions: {
     style: google.maps.ZoomControlStyle.SMALL,
     position: google.maps.ControlPosition.RIGHT_TOP
     },
     streetViewControl: false,
     mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    return options;
 }
 
 function mapStyles(){
  var styles = [
    {
     featureType: 'road.highway',
      elementType: "geometry",
     stylers: [
     { hue: '#ff6e00'},
     { saturation: -15 },
     { gamma: 0.56 },
     { lightness: 1 }
     ]
    },
    {
     featureType: "road.arterial",
      stylers: [
      { hue: '#aaff00' },
      { saturation: 0 },
      { lightness: 0 }
      ]
    },
    {
     featureType: "road.arterial",
     elementType: "labels",
     stylers: [
     { gamma: 0.56 },
     { lightness: -20 }
     ]
    },
    {
     featureType: 'road.local',
     elementType: "geometry",
     stylers: [
     { lightness:-80 }
     ]
    },
    {
     featureType: "road.local",
     elementType: "labels",
     stylers: [
     { hue: '#dd00ff' },
     { saturation: 74 },
     { gamma: 0.56 },
     { lightness: 0}
     ]
    },
    {
     featureType: 'landscape',
     stylers: [
     { hue: '#1900ff' },
     { saturation: -95 },
     { gamma: 0.56 },
     { lightness: -50 }
     ]
    },
    {
     featureType: 'poi.park',
     stylers: [
     { hue: '#22ff00' },
     { saturation: -4 },
     { lightness: -54 }
     ]
    },
    {
     featureType: 'water',
     stylers: [
     { hue: '#0055ff' },
     { saturation: -5 },
     { lightness: -20 }
     ]
    },
    {
     featureType: 'administrative.neighborhood',
     stylers: [
     { hue: '#21DB13' },
     { saturation: 60 }
     ]
    },
    {
     featureType: 'poi.business',
     stylers: [
     { hue: '#F8C64B' },
     { saturation: 60 }
     ]
    },
    {
     featureType: 'poi.school',
     stylers: [
     { hue: '#1105B1' },
     { saturation: 60 }
     ]
    },
    {
     featureType: 'administrative.locality',
     stylers: [
     { hue: '#D8C9B0' },
     { saturation: 60 }
     ]
    }
   ];
   return styles;
 }
 
 function setMarker(cat, location, name, mId){
  var image = new google.maps.MarkerImage('images/marker/'+cat+'.png',
              new google.maps.Size(28, 28),
              new google.maps.Point(0,0),
              new google.maps.Point(0, 28)
  );
  var shadow = new google.maps.MarkerImage('images/marker/mShadow.png',
               new google.maps.Size(44, 60),
               new google.maps.Point(0,0),
               new google.maps.Point(0, 60)
  );
  var shape = {
      coord: [1, 1, 1, 20, 20, 20, 20 , 1],
      type: 'poly'
  };
  var marker = new google.maps.Marker({
	   map: map,
	   position: location,
	   title: name,
	   icon: image,
	   shadow : shadow,
	   id : mId
  });
  return marker;
 }
     
 function clearMarkers(){
  for(x in markers){
    markers[x].setMap(null);
  }
 }
 
 function markerStopAnim(){
   for(s in markers){
	  markers[s].setAnimation(null);
   }
 }
    
 function loadMap(num, cat, pos, title, markerId){
  var fieldId = new Array();
  var eLink = '#show-events .event-link';
  var marker = setMarker(cat, pos, title, markerId);
  markers.push(marker);
  google.maps.event.addListener(marker, 'click', function(){
	$.each($('#event-info .heading'), function(){
	   fieldId.push(this.id);
	});
	$.each($(eLink+' a'),function(index){
	   var linkBkg = index%2 == 0 ? '#f0f0f0' : '#fff';
	   $(this).css('background-color', linkBkg);
	   index++;
	});
	var boxTop = $(eLink+' #'+markerId).position();
      //position event box @ sidebar event link height
	  var halfH = showEventsH / 2 + 60;
	  if(halfH > boxTop.top){
		 var setTop = boxTop.top - 21;
		 $('#arrow').css({'top' : '20px'}); 
	  }
	  else{
		 var setTop = boxTop.top - 150;	
		 $('#arrow').css({'top' : '150px'});	  
	  }
	  eventBox.css({'top' : setTop});
	
	$(eLink+' #'+markerId).css({'background-color' : '#ADD8E6'});
	for(s in markers){
      markers[s].setAnimation(null);
    }
	showEvent(fieldId, markerId);
  });
  
  if(num > 1){
    p++;
    var value = p * 100 / num;
    if(!firstLoad){
       $('#map-prog').show();
         mapProgress.show().progressbar({ 'value' : value });
         if(value == 100){
	       mapProgress.hide();
	       $('#map-prog').slideUp('fast');
	       p = 0;
	     }
    }
    else{
	  popUp.dialog({
	    width: 360,
	    modal: true
	  });
	 //show main progress bar if there are results 
      noResult.hide();
      progInfo.show();
      pbar.show();
      pbar.progressbar({ 'value': 0 });
	  pbar.progressbar({ 'value' : value });
	  if(value == 100){
	    pbar.hide('fast');
	    progInfo.hide('fast');
	    p = 0;
	    popUp.dialog('close');
	    firstLoad = false;
      }
     }
   }
 }
 
 function moveElem(element, l, t, d, finish){
    element.animate({'left' : l, 'top' : t},
             d, 'linear',
             finish
    );
  }   
 
 function strrpos(haystack, needle, offset) {
    // Finds position of last occurrence of a string within another string  
    // 
    // version: 1109.2015
    // discuss at: http://phpjs.org/functions/strrpos    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   input by: saulius
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // *     example 1: strrpos('Kevin van Zonneveld', 'e');    // *     returns 1: 16
    // *     example 2: strrpos('somepage.com', '.', false);
    // *     returns 2: 8
    // *     example 3: strrpos('baa', 'a', 3);
    // *     returns 3: false    // *     example 4: strrpos('baa', 'a', 2);
    // *     returns 4: 2
    var i = -1;
    if (offset) {
        i = (haystack + '').slice(offset).lastIndexOf(needle); // strrpos' offset indicates starting point of range till end,        // while lastIndexOf's optional 2nd argument indicates ending point of range from the beginning
        if (i !== -1) {
            i += offset;
        }
    } else {        i = (haystack + '').lastIndexOf(needle);
    }
    return i >= 0 ? i : false;
}

function nl2br (str, is_xhtml) {
    // Converts newlines to HTML line breaks  
    // 
    // version: 1109.2015
    // discuss at: http://phpjs.org/functions/nl2br    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   improved by: Philip Peterson
    // +   improved by: Onno Marsman
    // +   improved by: Atli Þór
    // +   bugfixed by: Onno Marsman    // +      input by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +   improved by: Maximusya
    // *     example 1: nl2br('Kevin\nvan\nZonneveld');    // *     returns 1: 'Kevin\nvan\nZonneveld'
    // *     example 2: nl2br("\nOne\nTwo\n\nThree\n", false);
    // *     returns 2: '<br>\nOne<br>\nTwo<br>\n<br>\nThree<br>\n'
    // *     example 3: nl2br("\nOne\nTwo\n\nThree\n", true);
    // *     returns 3: '\nOne\nTwo\n\nThree\n'    
    var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '' : '<br>';
 
    return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}
 
});