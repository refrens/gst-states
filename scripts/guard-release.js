#!/usr/bin/env node
/**
 * Release guard. Runs from release-it's `before:init` hook, so it fires on every
 * path into release-it -- including a bare `npm run release-it`, which is how
 * v1.73.0 got published to `latest` off an unmerged PR branch.
 *
 * Two rules:
 *   1. A real (non-prerelease) release must be cut from master.
 *   2. A feature or breaking bump must be opted into by name. The angular preset
 *      picks the number off the commit log, so without this nobody actually
 *      chooses to burn a minor.
 *
 * Prereleases (`npm run release:canary <id>`) skip both -- that is what feature branches
 * are supposed to use. A prerelease publishes to its own dist-tag, never `latest`, and no
 * caret range matches it. release-it tells us which it is, rather than an env var, so the
 * canary script also works under Windows cmd. The hook runs twice:
 *   before:init  argv[2] = ${version.isPreRelease}  ("true"/"false")
 *   before:bump  argv[2] = ${version}                (the resolved version, before any write)
 * The second call is needed because `--preRelease` does not win over an explicit version:
 * `npm run release:canary beta 1.75.0` sets isPreRelease=true but publishes 1.75.0 to latest.
 */
const { execFileSync } = require('child_process');

const RELEASE_BRANCH = 'master';
// A full-history `git log %B` is over 1MB in jupiter, which is execFileSync's default cap.
const MAX_BUFFER = 64 * 1024 * 1024;

// No shell: `range` below is built from a tag name, and git allows `;`, `$` and backticks in those.
const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: MAX_BUFFER,
  }).trim();

const fail = (lines) => {
  console.error(`\n  release blocked\n\n${lines.map((l) => `  ${l}`).join('\n')}\n`);
  process.exit(1);
};

const arg = process.argv[2] || '';
if (arg === 'true' || arg.includes('-')) process.exit(0);

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== RELEASE_BRANCH) {
  // The branch name becomes the prerelease id, and a slash would make it invalid semver.
  const canaryId = branch.replace(/[^0-9A-Za-z-]/g, '-');
  fail([
    `You are on "${branch}". A published release must come from ${RELEASE_BRANCH}.`,
    '',
    'For a branch build, cut a canary instead:',
    `  npm run release:canary ${canaryId}`,
  ]);
}

let range = '';
try {
  // --exclude "*-*" skips prerelease tags, so the range starts at the last real
  // release. Both tag shapes are matched: some repos tag v1.2.3, others 1.2.3.
  range = `${git(
    'describe',
    '--tags',
    '--abbrev=0',
    '--match',
    'v[0-9]*',
    '--match',
    '[0-9]*',
    '--exclude',
    '*-*',
  )}..HEAD`;
} catch (err) {
  // In a shallow clone the tags can be present but still unreachable from HEAD.
  const shallow = git('rev-parse', '--is-shallow-repository') === 'true';
  fail([
    'Could not find a release tag to measure the bump from.',
    'Reading the whole history instead would block on commits that already shipped,',
    'so this is a hard stop rather than a guess.',
    '',
    shallow
      ? 'This is a shallow clone, so the tags are not reachable from HEAD:'
      : 'Usually the tags are just missing locally:',
    shallow ? '  git fetch --unshallow --tags' : '  git fetch --tags',
  ]);
}

const commits = git('log', range, '--format=%B%x00')
  .split('\0')
  .map((c) => c.trim())
  .filter(Boolean);

// The angular preset is what actually picks the number, so read a commit the way it does
// (conventional-changelog-angular parser-opts + conventional-commits-parser):
//   header  /^(\w*)(?:\((.*)\))?: (.*)$/                 <- there is no "!" in it
//   notes   /^[\s|*]*(BREAKING CHANGE)[:\s]+(.*)/i, tested on every line after the header
// whatBump: any note -> major; else type "feat" -> minor; else patch.
// A "feat!:" header therefore does not parse at all and the preset computes a patch.
const HEADER = /^(\w*)(?:\((.*)\))?: (.*)$/;
const NOTE = /^[\s|*]*(BREAKING CHANGE)[:\s]+(.*)/i;
const BANG_HEADER = /^\w+(?:\(.*\))?!: /;

const header = (c) => c.split(/\r?\n/)[0];
const hasBreakingNote = (c) =>
  c
    .split(/\r?\n/)
    .slice(1)
    .some((line) => NOTE.test(line));
const hasBangType = (c) => BANG_HEADER.test(header(c));
const isFeat = (c) => (header(c).match(HEADER) || [])[1] === 'feat';

const notes = commits.filter(hasBreakingNote);
const bangOnly = commits.filter((c) => hasBangType(c) && !hasBreakingNote(c));
const breaking = [...notes, ...bangOnly];
// A feat that also carries a note is counted by the preset as breaking, not as a feature.
const feats = commits.filter((c) => isFeat(c) && !hasBreakingNote(c));

const list = (cs) => cs.map((c) => `  - ${header(c)}`);

// The two rules are checked independently. Opting into a major must not silently
// waive the minor check, because the preset can still land on a minor.
const blocked = [];

if (breaking.length && process.env.ALLOW_MAJOR_RELEASE !== '1') {
  blocked.push(
    `${breaking.length} breaking commit(s) since the last release:`,
    ...list(breaking),
    '',
    'Every consumer pins a caret range, so a major strands all of them.',
    'If that is really what you want:',
    '  ALLOW_MAJOR_RELEASE=1 npm run release',
  );
  if (bangOnly.length && !notes.length) {
    blocked.push(
      '',
      'Note: the angular preset does not read "!", so it will compute a PATCH here,',
      'not a major. Add a "BREAKING CHANGE:" footer if you want the major.',
    );
  }
}

if (feats.length && process.env.ALLOW_MINOR_RELEASE !== '1') {
  if (blocked.length) blocked.push('');
  blocked.push(
    `${feats.length} feat commit(s) since the last release make this a MINOR bump:`,
    ...list(feats),
    '',
    "A minor is matched by every consumer's caret range and ships to them",
    'on their next install. If that is intended:',
    '  ALLOW_MINOR_RELEASE=1 npm run release',
  );
}

if (blocked.length) fail(blocked);
