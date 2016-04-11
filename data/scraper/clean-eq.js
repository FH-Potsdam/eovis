var fs = require('fs')
var geolib = require('geolib')

var saveLocation = true;

var contents = fs.readFileSync('../usgs-earthquakes-2015.geojson');
var data = JSON.parse(contents);

var events = data.features,
    eventsClean = [];

//console.log("Number of events: " + events.length);

// Sort events by start time
events.sort(sortEventsByStartTime);

// Loop all events
for (var i=0; i<events.length; i++) {
    var event = events[i];

    // if (!isRelevantCategory(event.categories[0].title))
    //     continue;

    var eventClean = {};

    eventClean.id = event.id;
    eventClean.title = event.properties.title;
    eventClean.titleShort = cleanEarthquakeTitle(event.properties.title);
    eventClean.description = "Earthquake of magnitude " + event.properties.mag + " at " + event.properties.place + ". Alert: " + event.properties.alert;

    eventClean.mag = event.properties.mag;
    eventClean.tsunami = event.properties.tsunami;
    eventClean.alert = event.properties.alert;

    // Categories defined as in EONET
    eventClean.categories = [{
        id: 15,
        title: "Earthquakes",
        slug: "earthquakes"
    }];

    eventClean.startDate = {};
    eventClean.startDate.date = getDateStr(event.properties.time);
    eventClean.startDate.doy = dateToDOY(event.properties.time);

    eventClean.endDate = {};
    eventClean.endDate.date = getDateStr(event.properties.updated);
    eventClean.endDate.doy = dateToDOY(event.properties.updated);

    eventClean.closedDate = {};
    eventClean.closedDate.date = getDateStr(event.properties.updated);
    eventClean.closedDate.doy = dateToDOY(event.properties.updated);

    // Center / Radius parameters
    if (saveLocation) {

        // Geometries
        var center, radius = 0;

        var geom = event.geometry;

        center = {longitude: geom.coordinates[0], latitude: geom.coordinates[1]};

        var radiusArr = findMatchingWords(event.properties.place, "km");

        if (radiusArr) {
            radius = radiusArr[0];
            radius = radius.replace("km","");
        }

        radius = parseInt(radius,10) + 100;

        // console.log("radius: " + JSON.stringify(radiusArr) + ", r: " + radius);

        eventClean.location = center.latitude + ',' + center.longitude;
        eventClean.locationRadius = radius;
    }

    eventClean.geometries = [];
    // event.geometry.date = eventClean.startDate.date;
    eventClean.geometries.push(event.geometry);

    eventsClean.push(eventClean);
}

// console.log(JSON.stringify(eventsClean));

// Update file contents
data.features = eventsClean;

fs.writeFile('../usgs-earthquakes-2015-clean.json', JSON.stringify(data, null, 1), function (err) {
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
    var dateA = new Date(a.properties.time);
    var dateB = new Date(b.properties.time);
    // var dateA = new Date(a.geometries[0].date);
    // var dateB = new Date(b.geometries[0].date);

    return dateA.getTime() - dateB.getTime();
}

////////////////
// Date utils
////////////////

Date.prototype.getDOY = function() {
    var onejan = new Date(this.getFullYear(),0,1);
    return Math.ceil((this - onejan) / 86400000);
}

function getDateStr(date) {
    var day = new Date(date);
    return day.toISOString();
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

function cleanEarthquakeTitle(str) {

  // // https://en.wikipedia.org/wiki/Points_of_the_compass
  // var words = ['2015', 'NNE, SSW, ENE, '];
  //
  // for (var i = 0; i < words.length; i++) {
  //   str = str.split(words[i]).join('');
  // }

  str = str.split(' of ')[1];

  if (str) {
      // Remove country/region info
      // str = str.split(',')[0];

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

      str = str + " ";
  } else {
      str = "";
  }

  return str + "Earthquake";
}

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

function findMatchingWords(t, s) {
    var re = new RegExp("\\w*"+s+"\\w*", "g");
    return t.match(re);
}
