# Vilnius JUG website

Source of [vilnius-jug.lt](https://vilnius-jug.lt), the website of Vilnius JUG
(Java User Group). It is a single static page served by GitHub Pages from the
`master` branch.

The page shows:

- how to get notified about new events (Google Group, calendar, RSS)
- a link to the speaker registration form
- the list of events, one year at a time, with upcoming events highlighted

## Files

| Path | What it is |
|------|------------|
| `index.html` | The page |
| `css/jug.css` | Styles, including the phone layout |
| `js/app.js` | Small AngularJS app that renders the event list |
| `data/events.js` | **All events** – the only file you edit to add an event |
| `feed.xml` | RSS feed, generated – don't edit by hand |
| `events.ics` | Calendar feed, generated – don't edit by hand |
| `scripts/build-feeds.js` | Script that generates `feed.xml` and `events.ics` |
| `.github/workflows/feeds.yml` | GitHub Action that runs the script |
| `CNAME` | Custom domain for GitHub Pages |

## Adding an event

Add a new entry at the **top** of `data/events.js` (events are listed newest
first):

```js
{
  'id': '96',
  'type': 'Vilnius JUG',
  'date': '2026-12-10',
  'time': '18:30',
  'registration': {
    'title': 'Eventbrite',
    'url': 'https://vilniusjug96.eventbrite.com'
  },
  'venue': {
    'title': 'Wix Vilnius office',
    'map_url': 'https://goo.gl/maps/cRSfKnauH4F2'
  },
  'talks': [
    {'author': 'Speaker Name', 'title': 'Talk title'}
  ]
},
```

- `type` picks the icon: `Vilnius JUG`, `Vilnius JUG Conf`, `Vilnius Scala`
  or `Vilnius Clojure` (see `icons` in `js/app.js`).
- `time` is local Vilnius time. Leave it empty (`''`) if unknown; the calendar
  then shows an all-day event.
- Add `'status': 'canceled'` to mark a canceled event (shown as canceled in
  the calendar and RSS feeds; the page itself does not show it yet).

Commit and push to `master`. The page picks up the change right away, and the
feeds are updated automatically (see below).

## How the feeds are updated

The RSS feed (`feed.xml`) and calendar feed (`events.ics`) are generated from
`data/events.js`, so they never need to be edited by hand.

1. You push a change to `data/events.js` on `master`.
2. The **Build feeds** GitHub Action (`.github/workflows/feeds.yml`) starts.
   It also runs when the script or workflow itself changes, and can be started
   by hand from the repository's **Actions** tab ("Run workflow").
3. The Action runs `node scripts/build-feeds.js`, which writes fresh
   `feed.xml` and `events.ics`.
4. If either file changed, the Action commits them to `master` as
   `github-actions[bot]` with the message "Update RSS and calendar feeds".
5. GitHub Pages publishes the new files at
   [vilnius-jug.lt/feed.xml](https://vilnius-jug.lt/feed.xml) and
   [vilnius-jug.lt/events.ics](https://vilnius-jug.lt/events.ics).

Because the Action pushes a commit, **pull before your next change**
(`git pull`) to avoid a conflict on the feed files.

What goes into the feeds:

- **Calendar** – every event, in UTC, so Vilnius summer/winter time is handled.
  Events have no end time in `events.js`, so each one is assumed to last
  2 hours (`EVENT_LENGTH_HOURS` in the script).
- **RSS** – the 20 newest events (`RSS_ITEM_COUNT` in the script), each with
  talks, venue and registration link.

To build the feeds locally (needs Node.js 18 or newer):

```sh
node scripts/build-feeds.js
```

The output is deterministic: running it again on the same events produces
identical files, so the Action only commits when events really change.

## Previewing locally

Open `index.html` in a browser. AngularJS is loaded from a CDN, so you need an
internet connection.
