var fs = require('fs')
var geolib = require('geolib')
var request = require('request');
var qs = require('querystring');

var contents = fs.readFileSync('../eonet-events-2015-clean.json');
var data = JSON.parse(contents);

var events = data.events;

// console.log("Number of events: " + events.length);

var youtubeIt = 0,
    twitterIt = 0;
var allDataLoaded = false;


//////////////////
// Youtube Load
//////////////////

loadYoutubeVideosByIndex(youtubeIt, onYoutubeDataLoaded);

function onYoutubeDataLoaded(err, i, videosData) {

    if (err) {
        console.log(err);

    // Process incoming data
    } else if (videosData && videosData.items.length > 0) {
        console.log("Save " + videosData.pageInfo.totalResults + " videos!");
        data.events[i].youtube = videosData;
    }

    // Keep iterating
    youtubeIt++;
    if (youtubeIt < data.events.length) {
        loadYoutubeVideosByIndex(youtubeIt, onYoutubeDataLoaded);
        // loadSocialMediaByIndex(index, onSocialMediaLoaded);
    } else {
        console.log(" ");
        console.log("----- YOUTUBE DATA LOADING FINISHED!!!")
        console.log(" ");

        saveFileFile('../social/eonet-events-2015-youtube.json');
    }
}

//////////////////
// Youtube Load
//////////////////

//loadTweetsByIndex(iterator, onTwitterDataLoaded);

// function onTwitterDataLoaded(err, i, twitterData) {
//
//     if (err) {
//         console.log(err);
//
//     // Process incoming data
//     } else if (twitterData /*&& videosData.items.length > 0*/) {
//         //console.log("Save " + videosData.pageInfo.totalResults + " videos!");
//         data.events[i].twitter = twitterData;
//     }
//
//     // Keep iterating
//     twitterIt++;
//     if (twitterIt < data.events.length) {
//         loadTweetsByIndex(twitterIt, onTwitterDataLoaded);
//         // loadSocialMediaByIndex(index, onSocialMediaLoaded);
//     } else {
//         console.log(" ");
//         console.log("----- TWITTER DATA LOADING FINISHED!!!")
//         console.log(" ");
//
//         saveFileFile('../eonet-events-2015-clean-social.json');
//     }
// }


// Loop all events
// for (var i=0; i<events.length; i++) {
//     console.log("");
//     loadSocialMediaByIndex(i);
// }

// console.log(JSON.stringify(data.events));


/////////////////////////
// Location parameters
/////////////////////////

function calculateLocationParams(i) {

    console.log("--------- calculate location params");

    var event = data.events[i];

    // Geometries
    var center, radius;

    // Polygon
    if (event.geometries[0].type == 'Polygon') {

        var polygon = event.geometries[0].coordinates[0];

        //Calculate center
        var coordsObj = [];
        polygon.pop();
        polygon.forEach(function(coord, index) {
            coordsObj.push({longitude: coord[0], latitude: coord[1]})
        });

        center = geolib.getCenter(coordsObj);

        // Get bounds / distance to center
        var swCoords = polygon[0],
            neCoords = polygon[2];
        var sw = {longitude: swCoords[0], latitude: swCoords[1]},
            ne = {longitude: neCoords[0], latitude: neCoords[1]};

        // Calculate max distance inside the bounds. Result in meters
        var distInMeters = Math.max(geolib.getDistance(center, sw), geolib.getDistance(center, ne));

        // Convert to KM
        radius = Math.round(distInMeters/1000);
        if (radius < 50) radius = 50;

    // One point
    } else if (event.geometries[0].type == 'Point' && event.geometries.length == 1) {

        var geom = event.geometries[0];
        center = {latitude: geom.coordinates[1], longitude: geom.coordinates[0]};
        radius = 100;

    // More points (storm, etc.)
    } else if (event.geometries.length > 1) {
        console.log("more points: " + event.geometries.length + ", event: " + event.title);

        var geom = event.geometries;

        var coordsObj = [];
        geom.forEach(function(point, index) {
            coordsObj.push({longitude: point.coordinates[0], latitude: point.coordinates[1]})
        });

        center = geolib.getCenter(coordsObj);

        var firstCoords = event.geometries[0].coordinates,
            lastCoords  = event.geometries[event.geometries.length-1].coordinates;

        var first = {longitude: firstCoords[0], latitude: firstCoords[1]},
            last  = {longitude: lastCoords[0],  latitude: lastCoords[1]};

        // Calculate max distance inside the bounds. Result in meters
        var distInMeters = Math.max(geolib.getDistance(center, first), geolib.getDistance(center, last));

        // Convert to KM
        radius = Math.round(distInMeters/1000);
        if (radius < 50) radius = 100;

        console.log("center: " + JSON.stringify(center) + ", radius: " + radius);
        console.log(" ");
    }

    data.events[i].location = center.latitude + ',' + center.longitude;
    data.events[i].locationRadius = radius;
}


////////////////////////
// Social Media Load
////////////////////////

function loadYoutubeVideosByIndex(i, callback) {

    var event = data.events[i];

    console.log(" ");
    console.log("Load youtube videos for " + i + ": " + event.titleShort);

    // Get query text
    var queryText = event.titleShort;
    var publishedAfter = event.startDate.date;

    // Calculate geometries
    if (!event.location || event.location == '') {
        calculateLocationParams(i);
        event = data.events[i];
    }

    // Youtube doesn't accept values greater than 1000km
    var radius = (event.locationRadius > 1000) ? 1000 : event.locationRadius;

    var paramsYoutube = {
        maxResults: 50,
        location: event.location,
        locationRadius: radius + 'km',
        q: queryText,
        publishedAfter: publishedAfter
    };

    var socialData = {};

    // First load videos
    loadYoutubeVideos(paramsYoutube, function(err, videosData) {
        if (err) {
            return callback("Error retrieving videos! Error: " + err);
        }

        if (videosData == null) {
            videosData = {};
            //socialData.youtube = videosData;
        }

        // Load tweets
        callback(null, i, videosData);
    });
}

function loadYoutubeVideos(params, callback) {

    console.log("Search Videos - location: " + params.location + ", locationRadius: " + params.locationRadius + ", q: " + params.q + ", publishedAfter: " + params.publishedAfter + ", publishedBefore: " + params.publishedBefore);

    var apiBaseUrl = "http://tostnik.deneb.uberspace.de/scrapalous-api/youtube/videos/";
    var paramsStr = qs.stringify(params);

    console.log("query: " + apiBaseUrl + '?'+paramsStr);

    var videosData;
    request.get(apiBaseUrl + '?'+paramsStr, function (error, response, body) {
        if (error || response.statusCode != 200) {
            return (error) ? callback(error) : callback(response.statusCode);
        }

        console.log("Videos successfully retrieved");

        try {
            videosData = JSON.parse(body);
        } catch (e) {
            return callback(error);
        }

        callback(null, videosData);
    });
}

function loadTweetsByIndex(i, callback) {

    var event = data.events[i];

    console.log(" ");
    console.log("Load tweets for " + i + ": " + event.titleShort);

    // Get query text
    var queryText = event.titleShort;
    var publishedAfter = event.startDate.date;

    // Calculate geometries
    var coords, radius;
    if (!event.location || event.location == '') {
        calculateLocationParams(i);
        event = data.events[i];
    }

    var paramsTwitter = {
        count: 100,
        geocode: event.location + ',' + event.locationRadius,
        q: queryText
    };

    // First load videos
    loadTweets(paramsTwitter, function(err, twitterData) {
        if (err) {
            return callback("Error retrieving tweets! Error: " + err);
        }

        if (twitterData == null) {
            twitterData = {};
            //socialData.twitter = twitterData;
        }

        // Load tweets
        callback(null, i, twitterData);
    });
}

function loadTweets(params, callback) {

    console.log("Search Tweets - geocode: " + params.geocode + ", q: " + params.q);

    var apiBaseUrl = "http://tostnik.deneb.uberspace.de/scrapalous-api/twitter/search/tweets/";
    var paramsStr = qs.stringify(params);

    console.log("query: " + apiBaseUrl + '?'+paramsStr);

    var videosData;
    request.get(apiBaseUrl + '?'+paramsStr, function (error, response, body) {
        if (error || response.statusCode != 200) {
            return (error) ? callback(error) : callback(response.statusCode);
        }

        console.log("Videos successfully retrieved");

        try {
            videosData = JSON.parse(body);
        } catch (e) {
            return callback(error);
        }

        callback(null, videosData);
    });
}


////////////////////
// File Functions
////////////////////

function saveFileFile(file) {
  console.log("Saving social file...");

  fs.writeFile(file, JSON.stringify(data), function (err) {
      if (err) throw err;
      console.log('Social file saved!');
  });
}
