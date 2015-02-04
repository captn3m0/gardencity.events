'use strict';

var moment = require('moment-timezone')
var whitelistEvents = require('./whitelistEvents');
var blacklistEvents = require('./blacklistEvents');
var overlap = require('word-overlap');
var clc = require('cli-color');
var API = {
  getFacebookEvents: require('./facebookEvents').get,
  getMeetupEvents: require('./meetupEvents').get,
  getEventbriteEvents: require('./eventbriteEvents').get,
  getIcsEvents: require('./icsEvents').get
};
var clc = require('cli-color');

function removeDuplicates(feed) {
  var prev;
  var cur;
  var prevEvent;
  var curEvent;
  var i;
  var options = {
    ignoreCase: true,
    ignoreCommonWords: true,
    common: [
      'singapore',
      'meetup',
      'group',
      'first',
      'second',
      'third',
      'jan', 'january',
      'feb', 'february',
      'mar', 'march',
      'apr', 'april',
      'may',
      'jun', 'june',
      'jul', 'july',
      'aug', 'august',
      'sep', 'sept', 'september',
      'oct', 'october',
      'nov', 'november',
      'dec', 'december',
      '-'
    ],
    depluralize: true
  }
  var indexToRemove = [];

  for (i = 1; i < feed.length; i++) {
    prev = feed[ i - 1 ];
    prevEvent = prev.name + ' at ' + prev.location + ' by ' + prev.group_name;
    cur = feed[ i ];
    curEvent = cur.name + ' at ' + cur.location + ' by ' + cur.group_name;

    if (prev.formatted_time === cur.formatted_time) {
      var overlappedWords = overlap(prevEvent, curEvent, options);
      if (overlappedWords.length > 0) {
        console.log('Info: Removing duplicate event from feed:');
        console.log('Info: [Event A] ' + prev.url);
        console.log('Info: [Event B] ' + cur.url);
        console.log('Info: Overlapped words - ' + overlappedWords);
        indexToRemove.push(i);
      }
    }
  }

  indexToRemove.forEach(function(element) {
    feed.splice(element - 1, 1);
  })

  return feed;
}

function timeComparer(a, b) {
  return (moment(a.start_time).valueOf() -
          moment(b.start_time).valueOf());
}

function addEvents(type) {
  API[ 'get' + type + 'Events' ]().then(function(data) {
    data = data || [];
    var whiteEvents = data.filter(function(evt) { // filter black listed ids
      return !blacklistEvents.some(function(blackEvent) {
        return blackEvent.id === evt.id;
      });
    });
    exports.feed.events = exports.feed.events.concat(whiteEvents);
    exports.feed.events.sort(timeComparer);
    removeDuplicates(exports.feed.events);
    console.log(clc.green('Success: Added ' + whiteEvents.length + ' ' + type + ' events'));
    exports.feed.meta.total_events = exports.feed.events.length;
  }).catch(function(err) {
    console.error(clc.red('Error: Failed to add %s events: %s'), type, err.statusCode || err);
  });
}

function pastEvents(evt) {
  return moment.utc(evt.end_time) > moment.utc()
}

exports.feed = [];
exports.removeDuplicates = removeDuplicates;
exports.update = function() {
  exports.feed = {
    'meta': {
      'generated_at': new Date().toISOString(),
      'location': 'Singapore',
      'api_version': 'v1'
    },
    'events': {}
  };
  exports.feed.events = whitelistEvents.filter(pastEvents);
  console.log('Info: Updating the events feed... this may take a while');
  addEvents('Meetup');
  addEvents('Facebook');
  addEvents('Eventbrite');
  addEvents('Ics');
}
