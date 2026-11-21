const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// GST_STATES_IMPL lets the same tests run against another build (e.g. the published package).
const states = require(process.env.GST_STATES_IMPL || path.join(__dirname, '..'));

test('maps every GST state code to a name', () => {
  assert.equal(Object.keys(states).length, 40);
  for (const [code, name] of Object.entries(states)) {
    assert.match(code, /^\d{2}$/, `code ${code}`);
    assert.equal(typeof name, 'string');
    assert.ok(name.trim().length > 0, `name for ${code}`);
  }
});

test('uses the official GSTN state codes', () => {
  assert.equal(states['01'], 'Jammu And Kashmir');
  assert.equal(states['07'], 'Delhi');
  assert.equal(states['24'], 'Gujarat');
  assert.equal(states['27'], 'Maharashtra');
  assert.equal(states['29'], 'Karnataka');
  assert.equal(states['33'], 'Tamil Nadu');
});

test('has unique names', () => {
  const names = Object.values(states);
  assert.equal(new Set(names).size, names.length);
});
