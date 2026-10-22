import test from 'node:test';
import assert from 'node:assert/strict';
import { validPoint, walkingRoute } from '../server/walking.js';

test('walking coordinates reject missing, nonnumeric and out-of-range values', () => {
  for (const value of [null, {}, { latitude: null, longitude: 1 }, { latitude: 91, longitude: 0 }, { latitude: 1, longitude: Infinity }]) assert.ok(!validPoint(value));
  assert.equal(validPoint({ latitude: 10.756867, longitude: 78.8131 }), true);
});
test('keyless routing preserves the original road preview without inventing walking times', async () => {
  const originalFetch = global.fetch;
  const previous = process.env.ORS_API_KEY;
  delete process.env.ORS_API_KEY;
  global.fetch = async url => {
    assert.match(url, /router.project-osrm.org\/route\/v1\/driving/);
    return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 150, geometry: { coordinates: [[78, 10], [79, 11]] } }] }) };
  };
  try {
    const route = await walkingRoute({latitude:10,longitude:78}, {latitude:11,longitude:79});
    assert.deepEqual(route.coordinates, [[10,78],[11,79]]);
    assert.equal(route.mode, 'road-preview');
    assert.equal(route.timeMinutes, null);
  } finally { global.fetch=originalFetch; if(previous) process.env.ORS_API_KEY=previous; }
});
test('walking provider uses foot profile and converts longitude/latitude for Leaflet', async () => {
  const originalFetch = global.fetch;
  const previous = process.env.ORS_API_KEY;
  process.env.ORS_API_KEY = 'test';
  global.fetch = async (url, options) => {
    assert.match(url, /foot-walking/);
    assert.deepEqual(JSON.parse(options.body).coordinates, [[78, 10], [79, 11]]);
    return { ok: true, json: async () => ({ features: [{ geometry: { coordinates: [[78, 10], [79, 11]] }, properties: { summary: { distance: 150, duration: 120 }, segments: [{ steps: [{ instruction: 'Continue', distance: 150, way_points: [0, 1] }] }] } }] }) };
  };
  try {
    const route = await walkingRoute({ latitude: 10, longitude: 78 }, { latitude: 11, longitude: 79 });
    assert.deepEqual(route.coordinates, [[10, 78], [11, 79]]);
    assert.equal(route.timeMinutes, 2);
    assert.equal(route.steps[0].instruction, 'Continue');
  } finally { global.fetch = originalFetch; if (previous) process.env.ORS_API_KEY = previous; else delete process.env.ORS_API_KEY; }
});
