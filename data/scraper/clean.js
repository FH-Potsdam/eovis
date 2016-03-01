var fs = require('fs')
var geolib = require('geolib')

var saveLocation = true;

var contents = fs.readFileSync('../eonet-events-2015.json');
var data = JSON.parse(contents);

var events = data.events,
    eventsClean = [];

//console.log("Number of events: " + events.length);

// Sort events by start time
events.sort(sortEventsByStartTime);

// Loop all events
for (var i=0; i<events.length; i++) {
    var event = events[i];

    if (!isRelevantCategory(event.categories[0].title))
        continue;

    var eventClean = {};

    eventClean.id = event.id;
    eventClean.title = event.title;
    eventClean.titleShort = cleanEventTitle(event.title);
    eventClean.description = event.description;

    eventClean.categories = [];
    event.categories.forEach(function(cat, index) {
        eventClean.categories.push({
            id: cat.id,
            title: cat.title,
            slug: titleToSlug(cat.title)
        });
    });

    eventClean.startDate = {};
    eventClean.startDate.date = event.geometries[0].date;
    eventClean.startDate.doy = dateToDOY(event.geometries[0].date);

    if (event.geometries.length > 1) {
        eventClean.endDate = {};
        eventClean.endDate.date = event.geometries[event.geometries.length-1].date;
        eventClean.endDate.doy = dateToDOY(event.geometries[event.geometries.length-1].date);
    }

    eventClean.closedDate = {};
    eventClean.closedDate.date = event.closed;
    eventClean.closedDate.doy = dateToDOY(event.closed);

    // Center / Radius parameters
    if (saveLocation) {

        // Geometries
        var center, radius;

        // console.log(event.titleShort);

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
            //console.log("more points: " + event.geometries.length + ", event: " + event.title);

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

            //console.log("center: " + JSON.stringify(center) + ", radius: " + radius);
            //console.log(" ");
        }

        eventClean.location = center.latitude + ',' + center.longitude;
        eventClean.locationRadius = radius;
    }

    eventClean.geometries = event.geometries;

    eventsClean.push(eventClean);
}

// console.log(JSON.stringify(eventsClean));

// Update file contents
data.events = eventsClean;

fs.writeFile('../eonet-events-2015-clean.json', JSON.stringify(data), function (err) {
    if (err) throw err;
    console.log('Clean file saved!');
});


////////////////////
// Filter options
////////////////////

function isRelevantCategory(catTitle) {

    // if (catTitle == 'Drought' ||
    //     catTitle == 'Dust and Haze' ||
    //     catTitle == 'Temperature Extremes' ||
    //     catTitle == 'Water Color') {
    //     return false;
    // }

    return true;
}

////////////////
// JSON utils
////////////////

function sortEventsByStartTime(a, b) {
    var dateA = new Date(a.geometries[0].date);
    var dateB = new Date(b.geometries[0].date);

    return dateA.getTime() - dateB.getTime();
}

////////////////
// Date utils
////////////////

Date.prototype.getDOY = function() {
    var onejan = new Date(this.getFullYear(),0,1);
    return Math.ceil((this - onejan) / 86400000);
}

function dateToDOY(date) {
    var day = new Date(date);
    var onejan = new Date(day.getFullYear(),0,1);
    return Math.ceil((day - onejan) / 86400000);
    // return day.getDOY();
}

function getItemStartMonth(d) {
    var day = new Date(d.geometries[0].date);
    return (day.getMonth()+1);
}

function getItemEndMonth(d) {
    var day = new Date(d.closed);
    // var day = new Date(d.geometries[d.geometries.length-1].date);
    return (day.getMonth()+1);
}

function getItemStartDOY(d) {
    var day = new Date(d.geometries[0].date);
    return day.getDOY();
}

function getItemEndDOY(d) {
    var day = new Date(d.closed);
    // var day = new Date(d.geometries[d.geometries.length-1].date);
    return day.getDOY();
}

function getItemStartDateStr(d) {
    var day = new Date(d.geometries[0].date);
    return day.toDateString();
}

function getItemEndDateStr(d) {
    var day = new Date(d.closed);
    // var day = new Date(d.geometries[d.geometries.length-1].date);
    return day.toDateString();
}

//////////////////
// String utils
//////////////////

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

function titleToSlug(str) {
  str = str.replace(" ", "-");
  str = str.toLowerCase();
  str = str.replace(" ", "-");
  return str;
}
