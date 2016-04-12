var fs = require('fs')
var geolib = require('geolib')
var request = require('request');
var qs = require('querystring');
var config = require('./config');

var contents = fs.readFileSync('../social/usgs-earthquakes-2015-social.json');
// var contents = fs.readFileSync('../social/eonet-events-2015-social.json');
var data = JSON.parse(contents);

var events = data.events;

var timePointItemsArray = [],
    youtubeCount = 0,
    youtubeTotalResults = 0,
    twitterCount = 0,
    twitterTotalResults = 0;

// Loop all events
for (var i=0; i<events.length; i++) {
    var event = events[i];

    // Youtube
    var youtube = event.youtube;

    youtubeCount += youtube.items.length;
    youtubeTotalResults += youtube.totalResults;

    for (var j=0; j<youtube.items.length; j++) {
        var item = youtube.items[j];
        itemsPerTimePoint(item.publishedAt.doy)
    }

    // Twitter
    var twitter = event.twitter;

    if (twitter) {
        twitterCount += twitter.statuses.length;
        twitterTotalResults += twitter.totalResults;

        for (var j=0; j<twitter.statuses.length; j++) {
            var item = twitter.statuses[j];
            // itemsPerTimePoint(item.publishedAt.doy)
        }
    }
}

data.analytics = {};
data.analytics.youtubeCount = youtubeCount;
data.analytics.youtubeTotalResults = youtubeTotalResults;
data.analytics.twitterCount = twitterCount;
data.analytics.twitterTotalResults = twitterTotalResults;
data.analytics.maxDOY = getMaxOfArray(timePointItemsArray);

fs.writeFile('../social/usgs-earthquakes-2015-social-a.json', JSON.stringify(data, null, 1), function (err) {
// fs.writeFile('../social/eonet-events-2015-social-a.json', JSON.stringify(data, null, 1), function (err) {
    if (err) throw err;
    console.log('Analytics file saved!');
});

// Items per time point
function itemsPerTimePoint(timepoint) {

    if (!timePointItemsArray[timepoint]) {
        timePointItemsArray[timepoint] = 1;
    } else {
        timePointItemsArray[timepoint] = timePointItemsArray[timepoint]+1;
    }
    return timePointItemsArray[timepoint];
}

function getMaxOfArray(numArray) {
    var max = 0;
    numArray.forEach(function(num) {
        if (num && num > max) {
            max = num;
        }
    });
    return max;
    //return Math.max.apply(null, numArray);
}
