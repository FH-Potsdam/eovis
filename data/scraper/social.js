var fs = require('fs')
var geolib = require('geolib')
var request = require('request');
var qs = require('querystring');
var config = require('./config');

var contents = fs.readFileSync('../usgs-earthquakes-2015-clean.json');
// var contents = fs.readFileSync('../eonet-events-2015-clean.json');
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

console.log(" ");
console.log("----- LOAD YOUTUBE DATA")
console.log(" ");

function onYoutubeDataLoaded(err, i, videosData) {

    if (err) {
        console.log(err);

    // Process incoming data
    } else if (videosData) {
        console.log("Save " + videosData.count + " videos of " + videosData.totalResults + " total results!");
        data.events[i].youtube = videosData;
    }

    // Keep iterating
    youtubeIt++;
    // if (youtubeIt < 10) {
    if (youtubeIt < data.events.length) {
        loadYoutubeVideosByIndex(youtubeIt, onYoutubeDataLoaded);
        // loadSocialMediaByIndex(index, onSocialMediaLoaded);
    } else {
        console.log(" ");
        console.log("----- YOUTUBE DATA LOADING FINISHED!!!")
        console.log(" ");

        console.log("----- LOAD TWITTER DATA")
        loadTweetsByIndex(twitterIt, onTwitterDataLoaded);

        // saveFile('../social/usgs-earthquakes-2015-social.json');
        // saveFile('../social/eonet-events-2015-short-social.json');
    }
}

//////////////////
// Twitter Load
//////////////////

//loadTweetsByIndex(twitterIt, onTwitterDataLoaded);
function onTwitterDataLoaded(err, i, twitterData) {

    if (err) {
        console.log(err);

    // Process incoming data
    } else if (twitterData) {
        console.log("Save " + twitterData.count + " tweets");
        //console.log("Save " + videosData.pageInfo.totalResults + " videos!");
        data.events[i].twitter = twitterData;
    }

    // Keep iterating
    twitterIt++;
    // if (twitterIt < 10) {
    if (twitterIt < data.events.length) {
        loadTweetsByIndex(twitterIt, onTwitterDataLoaded);
        // loadSocialMediaByIndex(index, onSocialMediaLoaded);
    } else {
        console.log(" ");
        console.log("----- TWITTER DATA LOADING FINISHED!!!")
        console.log(" ");

        saveFile('../social/usgs-earthquakes-2015-social.json');
        // saveFile('../social/eonet-events-2015-social.json');
    }
}


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
        publishedAfter: publishedAfter,
        publishedBefore: '2016-01-01T00:00:00Z',
        // order: 'date'
        order: 'relevance'
    };

    var socialData = {};

    // First load videos
    loadYoutubeVideos(paramsYoutube, function(err, videosData) {
        if (err) {
            return callback("Error retrieving videos! Error: " + err);
        }

        var outData = {};
        if (videosData != null) {
            outData.count = videosData.items.length;
            outData.totalResults = videosData.pageInfo.totalResults;

            outData.items = [];
            if (videosData.items.length > 0) {

                var outItems = [];
                // var videoItems = videosData.items;
                //videoItems.sort(sortVideosByPublishedAt)
                //videosData.items.sort(sortVideosByCreationDate);

                videosData.items.forEach(function(item) {
                    var outItem = {};

                    // General metadata
                    outItem.id = item.id;
                    outItem.title = item.snippet.title;
                    outItem.description = item.snippet.description;

                    if (item.snippet.thumbnails.standard) {
                        outItem.thumbUrl = item.snippet.thumbnails.standard.url;
                    } else if (item.snippet.thumbnails.high) {
                        outItem.thumbUrl = item.snippet.thumbnails.high.url;
                    } else if (item.snippet.thumbnails.medium) {
                        outItem.thumbUrl = item.snippet.thumbnails.medium;
                    } else if (item.snippet.thumbnails.default) {
                        outItem.thumbUrl = item.snippet.thumbnails.default;
                    } else {
                        outItem.thumbUrl = "";
                    }

                    // Further metadata
                    outItem.channelId = item.snippet.channelId;
                    outItem.channelTitle = item.channelTitle;

                    outItem.tags = item.tags;
                    outItem.categoryId = item.categoryId;

                    // Date params
                    outItem.publishedAt = {};
                    outItem.publishedAt.date = item.snippet.publishedAt;
                    outItem.publishedAt.doy = dateToDOY(item.snippet.publishedAt);

                    outItem.recordingDate = {};
                    outItem.recordingDate.date = item.recordingDetails.recordingDate;
                    outItem.recordingDate.doy = dateToDOY(item.recordingDetails.recordingDate);

                    // Location params
                    outItem.location = item.recordingDetails.location;

                    outItems.push(outItem);
                    // outData.items.push(outItem);
                });

                outItems.sort(sortVideosByPublishedAt);
                // outItems.sort(sortVideosByDOY);
                outData.items = outItems;
            }
        }

        // Load tweets
        callback(null, i, outData);
    });
}

function loadYoutubeVideos(params, callback) {

    console.log("Search Videos - location: " + params.location + ", locationRadius: " + params.locationRadius + ", q: " + params.q + ", publishedAfter: " + params.publishedAfter + ", publishedBefore: " + params.publishedBefore);

    //var apiBaseUrl = "http://tostnik.deneb.uberspace.de/scrapalous-api/youtube/videos/";
    var apiBaseUrl = config.apiUrl + "/youtube/videos/";
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

        var outData = {};
        if (twitterData != null) {
            outData.count = twitterData.statuses.length;
            outData.totalResults = twitterData.statuses.length;
            //outData.totalResults = videosData.pageInfo.totalResults;

            outData.statuses = [];
            if (twitterData.statuses.length > 0) {
                twitterData.statuses.forEach(function(status) {
                    var outStatus = {};
                    outStatus = status;
                    outData.statuses.push(outStatus);
                });
            }
        }

        // Load tweets
        callback(null, i, outData);
    });
}

function loadTweets(params, callback) {

    console.log("Search Tweets - geocode: " + params.geocode + ", q: " + params.q);

    var apiBaseUrl = config.apiUrl + "/twitter/search/tweets/";
    var paramsStr = qs.stringify(params);

    console.log("query: " + apiBaseUrl + '?'+paramsStr);

    var twitterData;
    request.get(apiBaseUrl + '?'+paramsStr, function (error, response, body) {
        if (error || response.statusCode != 200) {
            return (error) ? callback(error) : callback(response.statusCode);
        }

        //console.log("Videos successfully retrieved");

        try {
            twitterData = JSON.parse(body);
        } catch (e) {
            return callback(error);
        }

        callback(null, twitterData);
    });
}

////////////////////
// Date Functions
////////////////////

function dateToDOY(date) {
    var day = new Date(date);
    var onejan = new Date(day.getFullYear(),0,1);
    return Math.ceil((day - onejan) / 86400000);
    // return day.getDOY();
}

function sortVideosByDOY(a, b) {
    return a.publishedAt.doy - b.publishedAt.doy;
}

function sortVideosByPublishedAt(a, b) {
    var dateA = new Date(a.publishedAt.date);
    var dateB = new Date(b.publishedAt.date);

    return dateA.getTime() - dateB.getTime();
}

// function sortVideosByPublishedAt(a, b) {
//     var dateA = new Date(a.snippet.publishedAt.date);
//     var dateB = new Date(b.snippet.publishedAt.date);
//
//     return dateA.getTime() - dateB.getTime();
// }

function sortVideosByRecordingDate(a, b) {
    var dateA = new Date(a.recordingDetails.recordingDate.date);
    var dateB = new Date(b.recordingDetails.recordingDate.date);

    return dateA.getTime() - dateB.getTime();
}

////////////////////
// File Functions
////////////////////

function saveFile(file) {
  console.log("Saving social file...");

  fs.writeFile(file, JSON.stringify(data, null, 1), function (err) {
      if (err) throw err;
      console.log('Social file saved!');
  });
}
