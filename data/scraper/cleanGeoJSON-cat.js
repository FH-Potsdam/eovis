var fs = require('fs')

var contents = fs.readFileSync('../eonet-events-2015.json');
var data = JSON.parse(contents);

// Read category from parameter
var category = process.argv[2];//'severe-storms';
console.log('Export GeoJSON file for category "' + category + '"');

var events = data.events;

var geojson = {
    "type": "FeatureCollection",
    "features": []
  };

// Sort events by start time
events.sort(sortEventsByStartTime);

// Loop all events
for (var i=0; i<events.length; i++) {
    var event = events[i];

    // Check category 1
    if (!isRelevantCategory(event.categories)) {
        continue;
    }

    var obj = {
        type: 'Feature',
        properties: {
            id: event.id,
            title: event.title,
            titleShort: cleanEventTitle(event.title),
            description: event.description,
            categories: event.categories
        },
        // TODO: Update this to catch LineStrings
        geometry: event.geometries[0]
        // geometry: {
        //     type: 'Point',
        //     coordinates: coords
        // }
    };

    // Add categories slug
    obj.properties.categories.forEach(function(cat, index) {
        cat.slug = titleToSlug(cat.title);
    });

    // Calculate dates
    obj.properties.startDate = {};
    obj.properties.startDate.date = event.geometries[0].date;
    obj.properties.startDate.doy = dateToDOY(event.geometries[0].date);

    if (event.geometries.length > 1) {
        obj.properties.endDate = {};
        obj.properties.endDate.date = event.geometries[event.geometries.length-1].date;
        obj.properties.endDate.doy = dateToDOY(event.geometries[event.geometries.length-1].date);
    }

    obj.properties.closedDate = {};
    obj.properties.closedDate.date = event.closed;
    obj.properties.closedDate.doy = dateToDOY(event.closed);

    // Add feature
    geojson.features.push(obj);
}

// console.log(JSON.stringify(geojson));

fs.writeFile('../geojson/eonet-events-2015-' + category + '.geojson', JSON.stringify(geojson), function (err) {
    if (err) throw err;
    console.log('JSON file saved for category "' + category + '"');
});


////////////////////
// Filter options
////////////////////

function isRelevantCategory(categories) {

    for (var i=0; i<categories.length; i++) {
        var cat = categories[i];
        if (category == titleToSlug(cat.title)) {
            return true;
        }
    }

    return false;
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
  str = str.toLowerCase();
  str = str.replace(" ", "-");
  return str;
}
