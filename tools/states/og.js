#!/usr/bin/env node
// Renders the share cards for the state requirement pages that don't have one yet:
//   coi-requirements/og.png, coi-requirements/<state>/og.png
//
//   node tools/states/og.js          only missing cards
//   node tools/states/og.js --all    re-render every card (after a title or design change)
//
// Same card design and font check as the blog (tools/blog/og.js).
const fs = require('fs');
const path = require('path');
const { render } = require('../blog/og');
const { STATES, HUB, url, meta } = require('./pages');

const ROOT = path.resolve(__dirname, '..', '..');
const foot = 'forsured.ai/coi-requirements';
const jobs = [
  { file: `${HUB}og.png`, kicker: 'COI requirements by state', title: 'Contractor insurance requirements by state', foot },
  ...STATES.map((s) => ({ file: `${url(s)}og.png`, kicker: 'COI requirements by state', title: meta(s).h1, foot })),
].map((j) => ({ ...j, file: j.file.replace(/^\//, '') }));

const todo = process.argv.includes('--all') ? jobs : jobs.filter((j) => !fs.existsSync(path.join(ROOT, j.file)));
render(todo).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
