
///////////////
// Mapbox GL
///////////////

var markerRadius = 5;
var markerOpacity = 0.6;

var eventFilter = document.getElementById('event-filter');

///////////////
// Mapbox GL
///////////////

// Config file must be loaded before
mapboxgl.accessToken = config.mapbox.accessToken;

var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/light-v8', //stylesheet location
    center: [0, 0], // starting position
    zoom: 0 // starting zoom
});

// Load events on map load
map.on('style.load', function () {
    console.log("map loaded");
    loadEvents();
});


/////////////////////
// Map Interaction
/////////////////////

// Hover effect
map.on("mousemove", function(e) {
    map.featuresAt(e.point, {
        radius: markerRadius + 5,
        layers: ["markers"]
    }, function (err, features) {
        if (!err && features.length) {
            map.setFilter("tooltips", ["==", "title", features[0].properties.title]);
        } else {
            map.setFilter("tooltips", ["==", "title", ""]);
        }
    });
});

// Use the same approach as above to indicate that the symbols are clickable
// by changing the cursor style to 'pointer'.
map.on("mousemove", function(e) {
    map.featuresAt(e.point, {
        radius: markerRadius + 5,
        layers: ["markers", "videos"]
    }, function (err, features) {
        map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';
    });
});

// When a click event occurs near a marker icon, open a popup at the location of
// the feature, with description HTML from its properties.
map.on("click", function(e) {
    map.featuresAt(e.point, {
        radius: markerRadius + 5,
        layers: ["markers", "videos"],
        includeGeometry: true
    }, function (err, features) {
        if (err || !features.length)
            return;

        var feature = features[0];

        // Click on Events
        if (feature.properties.type == 'event') {

          var zoom = (map.getZoom() < 6) ? 6 : map.getZoom();

          // Jump to the event position
          map.flyTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
            bearing: 0,

            // These options control the flight curve, making it move
            // slowly and zoom out almost completely before starting
            // to pan.
            curve: 1,
            speed: 0.8
          });

          // Load social media
          loadSocialMediaByFeature(feature);

          map.once('moveend', function(e) {
            // Show Popup
            new mapboxgl.Popup()
                .setLngLat(feature.geometry.coordinates)
                .setHTML(getEventPopupContent(feature))
                .addTo(map);
          });

        // Click on video
        } else if (feature.properties.type == 'video') {

            // Show Popup
            new mapboxgl.Popup()
                .setLngLat(feature.geometry.coordinates)
                .setHTML(/*'<b>' + feature.properties.title + '</b><br />' +*/ getYoutubeEmbedCode(feature.properties.id))
                .addTo(map);
        }
    });
});


////////////
// Events
////////////

function loadEvents() {
    loadEONETEvents();
    // loadUSGSEvents();
}


//////////////////
// EONET Events
//////////////////

var eventsGeoJSON = [],
    eventsGeoJSONPoints = [],
    eventsGeoJSONPolygons = [];

var eonetServer = "http://eonet.sci.gsfc.nasa.gov/api/v2.1";

// Looad events from EONET Server
function loadEONETEvents(onComplete) {

  // Closed Events in the last year
  $.getJSON('data/eonet-events-2015.json').done(onEONETEventsLoaded);

  // $.getJSON( eonetServer + "/events", {
  //     status: "closed",
  //     // limit: 20,
  //     days: 365,
  // }).done(onEONETEventsLoaded);

  // Open events
  // $.getJSON( eonetServer + "/events", {
  //     status: "open",
  // }).done(onEONETEventsLoaded);
}

// Prepare and map event data when loaded
function onEONETEventsLoaded(data) {
  console.log("EONET returned " + data.events.length + " events");

  // Convert events form return format to GeoJSON to use them with MapboxGL
  var geojson = eonetDataToGeoJSON(data);

  // Map events
  mapEONETEvents(geojson);
}


///////////////////
// Event Mapping
///////////////////

function mapEONETEvents(markers) {

  console.log("map " + markers.features.length + " events");

  // Markers source
  var sourceObj = map.getSource('markers');

  if (!sourceObj) {
    console.log("Create markers source");
    sourceObj = new mapboxgl.GeoJSONSource({ data: markers });
    map.addSource('markers', sourceObj);
  } else {
    console.log("Add more data to markers source");
    sourceObj.setData(markers);
  }


  markers.features.forEach(function(feature) {

    // var symbol = feature.properties['marker-symbol'];
    var catTitle = feature.properties.categories[0].title;
    var catSlug = titleToSlug(catTitle);
    var layerID = catSlug;

    // Add a layer for this symbol type if it hasn't been added already.
    if (!map.getLayer(layerID)) {

      // console.log("layerID: " + layerID);
      map.addLayer({
        // "id": "markers",
        "id": layerID,
        "interactive": true,
        "type": "circle",
        "source": "markers",
        "paint": {
            "circle-radius": markerRadius,
            "circle-opacity": markerOpacity,
            "circle-color": getEventColor(catSlug)
        },
        "filter": ["==", "catslug", layerID]
      });

      // Add checkbox and label elements for the layer.
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.id = layerID;
      input.checked = true;
      eventFilter.appendChild(input);

      var label = document.createElement('label');
      label.setAttribute('for', layerID);
      label.textContent = catTitle;
      eventFilter.appendChild(label);

      // When the checkbox changes, update the visibility of the layer.
      input.addEventListener('change', function(e) {
          map.setLayoutProperty(layerID, 'visibility',
              e.target.checked ? 'visible' : 'none');
      });
    }
  });

  // Text
  if (!map.getLayer('tooltips')) {
    map.addLayer({
      "id": "tooltips",
      "type": "symbol",
      "source": "markers",
      "layout": {
          "text-field": "{title}",
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-offset": [0, -1],
          "text-anchor": "bottom",
          "text-size": 12
      },
      "filter": ["==", "title", ""]
    });
  }

  // Areas
  // var sourceAreasObj = new mapboxgl.GeoJSONSource({ data: eventsGeoJSONPolygons });
  // map.addSource('areas', sourceAreasObj);
  //
  // map.addLayer({
  //   "id": "areas",
  //   "type": "fill",
  //   "source": "areas",
  //   "paint": {
  //       "fill-color": "rgba(55,148,179,1)",
  //       "fill-opacity": 0.5
  //   }
  // });
}


//////////////////
// Event Popups
//////////////////

function getEventPopupContentLite(feature) {
  return feature.properties.title_clean;
}

function getEventPopupContent(feature) {

  var eventDate = new Date(feature.properties.date);
  eventDate = eventDate.getDate() + "/" + (eventDate.getMonth()+1) + "/" + eventDate.getFullYear();

  // Create custom popup content
  var content = '<b>' + feature.properties.title_clean + '</b><br>' + eventDate + " | " + feature.properties.categories[0].title;
  if (feature.properties.description.length) {
    content += '<br><br>' + feature.properties.description;
  }

  return content;
}


//////////////////////
// Event Conversion
//////////////////////

function eonetDataToGeoJSON(data) {

  // var geojson = {
  //     "type": "FeatureCollection",
  //     "features": []
  //   };

  var geojsonPoints = {
      "type": "FeatureCollection",
      "features": []
    };

  // var geojsonPolygons = {
  //     "type": "FeatureCollection",
  //     "features": []
  //   };

  $.each( data.events, function( key, event ) {
    if (event.categories[0].title != 'Drought' &&
        event.categories[0].title != 'Dust and Haze' &&
        event.categories[0].title != 'Temperature Extremes' &&
        event.categories[0].title != 'Water Color') {

      // geojson.features.push(eonetEventToGeoJSONObject(event));

      // Points
      var pointObj = eonetEventToGeoJSONPoint(event);
      if (pointObj) {
          geojsonPoints.features.push(pointObj);
      }

      // Polygons
      // var polyObj = eonetEventToGeoJSONPolygons(event);
      // if (polyObj) {
      //     geojsonPolygons.features.push(polyObj);
      // }
    }
  });

  // eventsGeoJSON = geojson;
  // eventsGeoJSONPoints = geojsonPoints;
  // eventsGeoJSONPolygons = geojsonPolygons;

  return geojsonPoints;
}

// Get points for all events. Also for polygons and lines.
function eonetEventToGeoJSONPoint(event) {

  var object = null,
      coords;

  // Points
  if (event.geometries[0].type == 'Point') {

    coords = event.geometries[0].coordinates;


  // Polygons
  } else if (event.geometries[0].type == 'Polygon') {

    var polygon = event.geometries[0].coordinates;

    var swCoords = polygon[0][0];
    var neCoords = polygon[0][2];

    var sw = new mapboxgl.LngLat(swCoords[0], swCoords[1]);
    var ne = new mapboxgl.LngLat(neCoords[0], neCoords[1]);
    var llb = new mapboxgl.LngLatBounds(sw, ne);

    coords = llb.getCenter().toArray();
  }

  object = {
      type: 'Feature',
      properties: {
          type: "event",
          id: event.id,
          title: event.title,
          title_clean: cleanEventTitle(event.title),
          description: event.description,
          link: event.link,
          catslug: titleToSlug(event.categories[0].title),
          categories: event.categories,
          sources: event.sources,
          date: event.geometries[0].date
      },
      geometry: {
          type: 'Point',
          coordinates: coords
      }
  };

  return object;
}

// Convert data to the proper GeoJSON format
function eonetEventToGeoJSONPolygons(event) {

  var object = null;

  // Polygons
  if (event.geometries[0].type == 'Polygon') {

    object = {
      type: 'Feature',
      properties: {
          type: "event",
          id: event.id,
          title: event.title,
          title_clean: cleanEventTitle(event.title),
          description: event.description,
          link: event.link,
          catslug: titleToSlug(event.categories[0].title),
          categories: event.categories,
          sources: event.sources,
          date: event.geometries[0].date
      },
      geometry: {
          type: 'Polygon',
          coordinates: event.geometries[0].coordinates
      }
    };
  }

  return object;
}

// Convert data to the proper GeoJSON format
function eonetEventToGeoJSONObject(event) {

  var object = {};

  // Points
  if (event.geometries[0].type == 'Point') {
    object = {
        type: 'Feature',
        properties: {
            type: "event",
            // 'marker-color': '#3ca0a0',
            // 'marker-size': 'large',
            // 'marker-symbol': 'rocket',
            id: event.id,
            title: event.title,
            title_clean: cleanEventTitle(event.title),
            description: event.description,
            link: event.link,
            catslug: titleToSlug(event.categories[0].title),
            categories: event.categories,
            sources: event.sources,
            date: event.geometries[0].date
        },
        geometry: {
            type: 'Point',
            coordinates: event.geometries[0].coordinates
        }
    };

  // Polygons
  } else if (event.geometries[0].type == 'Polygon') {

    object = {
      type: 'Feature',
      properties: {
          type: "event",
          // fillColor: "#fbca19",
          // fillOpacity: "0.8",
          // 'marker-symbol': 'harbor',
          id: event.id,
          title: event.title,
          title_clean: cleanEventTitle(event.title),
          description: event.description,
          link: event.link,
          catslug: titleToSlug(event.categories[0].title),
          categories: event.categories,
          sources: event.sources,
          date: event.geometries[0].date
      },
      geometry: {
          type: 'Polygon',
          coordinates: event.geometries[0].coordinates
      }
    };
  }

  return object;
}


//////////////////
// Social Media
//////////////////

function loadSocialMediaByFeature(feature) {
    // Calculate geometries
    var coords = mapboxgl.LngLat.convert(feature.geometry.coordinates), // LngLat object {lng, lat}
        radius = 100; // in km

    /*var coords, radius;
    if (feature.geometry.type == 'Point') {
      coords = marker.getLatLng();
      radius = 100;
    } else if (feature.geometry.type == 'Polygon') {

      coords = marker.getBounds().getCenter();

      var sw = marker.getBounds().getSouthWest(),
          ne = marker.getBounds().getNorthEast();

      // Calculate max distance inside the bounds. Result in meters
      var distInMeters = Math.max(coords.distanceTo(sw), coords.distanceTo(ne));

      // Convert to KM
      radius = Math.round(distInMeters/1000);
    }*/

    var paramsYoutube = {
        maxResults: 50,
        location: coords.lat + ',' + coords.lng,
        locationRadius: radius + 'km',
        q: feature.properties.title_clean,
        publishedAfter: feature.properties.date
    };

    loadYoutubeVideos(paramsYoutube);

    var paramsTwitter = {
        count: 100,
        geocode: coords.lat + ',' + coords.lng + ',' + radius + 'km',
        q: feature.properties.title_clean
    };

    loadTweets(paramsTwitter);
}

//////////////////////////
// Social Media markers
//////////////////////////

function clearMarkers() {
  console.log("Remove all markers");
  // youtubeMarkers.clearLayers();
  // twitterMarkers.clearLayers();
}


/////////////
// Youtube
/////////////

function loadYoutubeVideos(params) {

  // console.log("Search Videos - location: " + params.location + ", locationRadius: " + params.locationRadius + ", q: " + params.q + ", publishedAfter: " + params.publishedAfter + ", publishedBefore: " + params.publishedBefore);

  $.ajax({
    type: 'GET',
    dataType: "json",
    url: 'http://tostnik.deneb.uberspace.de/scrapalous-api/youtube/videos/',
    data: params,
    success: function (data) {
      var geojson = youtubeVideosDataToGeoJSON(data);
      mapGeoJSONVideos(geojson);
    },
    error: function (xhr, status, error) {
        alert('Error connecting to the server: ' + status);
    },
  });
}

function mapGeoJSONVideos(videos) {

  console.log("map " + videos.features.length + " videos");

  // Markers source
  var sourceObj = map.getSource('videos');
  if (!sourceObj) {
    sourceObj = new mapboxgl.GeoJSONSource({ data: videos });
    map.addSource('videos', sourceObj);
  } else {
    sourceObj = map.getSource('videos');
    sourceObj.setData(videos);
  }

  // Markers layer
  map.addLayer({
    "id": "videos",
    "interactive": true,
    "type": "symbol",
    "source": "videos",
    "paint": {
      "icon-color": "#ff0000"
    },
    "layout": {
        "icon-image": "default_marker"
        // "icon-image": "{marker-symbol}-15"
    }
  });
}

function youtubeVideosDataToGeoJSON(data) {

  var geojson = {
      "type": "FeatureCollection",
      "features": []
    };

  $.each( data.items, function( key, item ) {
    // Points
    var obj = youtubeVideoToGeoJSON(item);
    if (obj) {
        geojson.features.push(obj);
    }
  });

  return geojson;
}

function youtubeVideoToGeoJSON(item) {

  var object = null,
      coords = [item.recordingDetails.location.longitude, item.recordingDetails.location.latitude];

  object = {
      type: 'Feature',
      properties: {
          type: "video",
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          date: item.snippet.publishedAt
      },
      geometry: {
          type: 'Point',
          coordinates: coords
      }
  };

  return object;
}


////////////
// Tweets
////////////

function loadTweets(params) {

  $.ajax({
    type: 'GET',
    dataType: "json",
    url: 'http://tostnik.deneb.uberspace.de/scrapalous-api/twitter/search/tweets/',
    data: params,
    success: function (data) {
      // mapTweets(data); // data already comes in json format because of dataType var
    },
    error: function (xhr, status, error) {
        alert('Error connecting to the server: ' + status);
    },
  });
}


//////////////////
// Design Utils
//////////////////

function getEventColor(cat) {

  var color = "";

  if (cat == "severe-storms") {
    color = "#26D1F9";
  } else if (cat == "volcanoes") {
    color = "#C99191";
  } else if (cat == "wildfires") {
    color = "#ED5D5A";
  } else if (cat == "floods") {
    color = "#5E7CD3";
  } else {
    color = "rgba(55,148,179,1)";
  }

  return color;
}


/////////////////
// Event Utils
/////////////////

function cleanEventTitle(str) {

  // Remove date and
  var words = ['2015', 'Winter', 'Fall', 'Autumn', 'Spring', 'Summer', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  for (var i = 0; i < words.length; i++) {
    str = str.split(words[i]).join('');
  }

  // Trim whitespaces at the end of the string
  str = str.replace(/\s*$/,"");

  // Remove other symbols
  str = str.replace(/\,$/, '');
  str = str.replace(/\-$/, '');

  // Remove / and whitespace
  str = str.replace(/\/$/, '');
  str = str.replace(/\s*$/,"");

  // Remove other symbols again
  str = str.replace(/\,$/, '');
  str = str.replace(/\-$/, '');

  // Clear whitespace again
  str = str.replace(/\s*$/,"");

  return str;
}


////////////////////////
// Social Media Utils
////////////////////////

function getYoutubeEmbedCode(id) {
  return '<iframe src="http://www.youtube.com/embed/' + id + '"></iframe>';
}


///////////////
// Geo Utils
///////////////

function turnLatLng(coords) {
  var turned = [];
  for (var i=0; i<coords.length; i++) {
    turned.push([coords[i][1], coords[i][0]]);
  }
  // console.log(turned);
  return turned;
}


////////////////
// Text Utils
////////////////

function titleToSlug(str) {
  str = str.toLowerCase();
  str = str.replace(" ", "-");
  return str;
}

function autolink(str, attributes) {
    attributes = attributes || {};

    var attrs = "";
    for (var name in attributes) {
        attrs += " "+ name +'="'+ attributes[name] +'"';
    }

    var reg = new RegExp("(\\s?)((http|https|ftp)://[^\\s<]+[^\\s<\.)])", "gim");
    str = str.toString().replace(reg, '$1<a target="blank" href="$2"'+ attrs +'>$2</a>');

    return str;
}
