// Builds feed.xml (RSS) and events.ics (calendar) from data/events.js.
//
// Usage: node scripts/build-feeds.js
//
// Runs automatically on GitHub (see .github/workflows/feeds.yml) whenever
// data/events.js changes, so normally you don't need to run it by hand.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_URL = 'https://vilnius-jug.lt/';
const SITE_TITLE = 'Vilnius JUG';
const SITE_DESCRIPTION = 'Vilnius JUG (Java User Group) events';
const TIME_ZONE = 'Europe/Vilnius';
const EVENT_LENGTH_HOURS = 2;   // events.js has no end time, so assume this
const RSS_ITEM_COUNT = 20;      // newest events to include in the RSS feed

const root = path.join(__dirname, '..');

// --- Load events -----------------------------------------------------------

function loadEvents() {
  const source = fs.readFileSync(path.join(root, 'data/events.js'), 'utf8');
  const context = {};
  vm.runInNewContext(source + '\nthis.events = events;', context);
  // Newest first
  return context.events.slice().sort((a, b) => b.date.localeCompare(a.date));
}

// --- Event helpers ---------------------------------------------------------

function title(event) {
  const number = /^\d+$/.test(event.id) ? ' #' + event.id : '';
  const prefix = isCanceled(event) ? 'Canceled: ' : '';
  return prefix + event.type + number;
}

function isCanceled(event) {
  return event.status === 'canceled';
}

function hasTime(event) {
  return Boolean(event.time);
}

function link(event) {
  return (event.registration && event.registration.url) || SITE_URL;
}

// Plain-text description: talks, venue and registration link
function description(event) {
  const lines = (event.talks || []).map(talk =>
    talk.author ? talk.author + ': ' + talk.title : talk.title);

  if (event.venue && event.venue.title) {
    lines.push('Venue: ' + event.venue.title);
  }
  if (event.registration && event.registration.url) {
    lines.push('Registration: ' + event.registration.url);
  }
  return lines.join('\n');
}

// Convert a local Vilnius date ("2026-11-17") and time ("18:30") to a UTC Date
function startTime(event) {
  const [year, month, day] = event.date.split('-').map(Number);
  const [hour, minute] = (event.time || '00:00').split(':').map(Number);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(asIfUtc - vilniusOffsetMinutes(new Date(asIfUtc)) * 60000);
}

// How many minutes Vilnius time is ahead of UTC at the given moment
function vilniusOffsetMinutes(date) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric'
  }).formatToParts(date).forEach(part => { parts[part.type] = Number(part.value); });

  const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return (local - date.getTime()) / 60000;
}

// --- RSS -------------------------------------------------------------------

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRss(events) {
  const items = events.slice(0, RSS_ITEM_COUNT).map(event => {
    const when = event.date + (hasTime(event) ? ' ' + event.time : '');
    return [
      '    <item>',
      '      <title>' + escapeXml(title(event) + ' – ' + when) + '</title>',
      '      <link>' + escapeXml(link(event)) + '</link>',
      '      <guid isPermaLink="false">' + escapeXml(SITE_URL + '#event-' + event.id) + '</guid>',
      '      <pubDate>' + startTime(event).toUTCString() + '</pubDate>',
      '      <description>' + escapeXml(description(event)).replace(/\n/g, '&lt;br&gt;') + '</description>',
      '    </item>'
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>' + SITE_TITLE + '</title>',
    '    <link>' + SITE_URL + '</link>',
    '    <description>' + SITE_DESCRIPTION + '</description>',
    '    <language>en</language>',
    '    <atom:link href="' + SITE_URL + 'feed.xml" rel="self" type="application/rss+xml"/>',
    ...items,
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');
}

// --- iCalendar -------------------------------------------------------------

function escapeIcs(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// 20261117T163000Z
function icsDateTime(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// 20261117
function icsDate(dateString) {
  return dateString.replace(/-/g, '');
}

// The iCalendar format wants lines of at most 75 bytes; longer lines continue
// on the next line, starting with a space.
function foldLine(line) {
  const chunks = [];
  let current = '';
  for (const char of line) {
    const limit = chunks.length === 0 ? 75 : 74;
    if (Buffer.byteLength(current + char) > limit) {
      chunks.push(current);
      current = '';
    }
    current += char;
  }
  chunks.push(current);
  return chunks.join('\r\n ');
}

function buildIcs(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vilnius JUG//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + SITE_TITLE,
    'X-WR-TIMEZONE:' + TIME_ZONE
  ];

  events.forEach(event => {
    const start = startTime(event);
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + event.id + '@vilnius-jug.lt');
    lines.push('DTSTAMP:' + icsDateTime(start));

    if (hasTime(event)) {
      const end = new Date(start.getTime() + EVENT_LENGTH_HOURS * 3600000);
      lines.push('DTSTART:' + icsDateTime(start));
      lines.push('DTEND:' + icsDateTime(end));
    } else {
      lines.push('DTSTART;VALUE=DATE:' + icsDate(event.date));
    }

    lines.push('SUMMARY:' + escapeIcs(title(event)));
    lines.push('DESCRIPTION:' + escapeIcs(description(event)));
    if (event.venue && event.venue.title) {
      lines.push('LOCATION:' + escapeIcs(event.venue.title));
    }
    lines.push('URL:' + link(event));
    lines.push('STATUS:' + (isCanceled(event) ? 'CANCELLED' : 'CONFIRMED'));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// --- Main ------------------------------------------------------------------

const events = loadEvents();
fs.writeFileSync(path.join(root, 'feed.xml'), buildRss(events));
fs.writeFileSync(path.join(root, 'events.ics'), buildIcs(events));
console.log('Wrote feed.xml and events.ics for ' + events.length + ' events');
