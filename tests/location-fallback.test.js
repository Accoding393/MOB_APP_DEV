import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../client/app.js', import.meta.url), 'utf8');
const picker = source.slice(source.indexOf('function pickGuestRouteOrigin'), source.indexOf('function directionUrl'));
function setup(locationService, collegeName = 'National Institute of Technology Tiruchirappalli') {
  const context = {
    locationService, state: { view: 'map', mapRoute: { venueId: 1, origin: null }, user: { college_name: collegeName } },
    NITT_MAIN_GATE: { latitude: 10.756867, longitude: 78.8131, label: 'NITT Main Gate' },
    stopTracking() {}, toast() {}, document: { querySelector: () => null }, updateRouteMarkerAndPath() {},
    origins: []
  };
  vm.createContext(context);
  vm.runInContext(picker + '\npickGuestRouteOrigin({id:1}, origin => { origins.push(origin); state.mapRoute.origin = origin; });', context);
  return context;
}
test('denied location restores NITT Main Gate origin', () => {
  const context = setup({ watchPosition(_ok, denied) { denied({code:1}); return 1; } });
  assert.equal(context.origins[0].label, 'NITT Main Gate');
  assert.equal(context.origins[0].latitude, 10.756867);
});
test('missing geolocation also uses Main Gate', () => {
  assert.equal(setup(null).origins[0].label, 'NITT Main Gate');
});
test('permission granted keeps the actual current position', () => {
  const context = setup({ watchPosition(ok) { ok({coords:{latitude:10.76,longitude:78.81,accuracy:5}}); return 1; } });
  assert.equal(context.origins[0].label, 'Your current location');
  assert.equal(context.origins[0].latitude, 10.76);
});
test('another college does not receive a Trichy fallback', () => {
  assert.equal(setup(null, 'Another College').origins.length, 0);
});
test('late location failure cannot replace a valid GPS origin or a different destination', () => {
  let success, failure;
  const context = setup({watchPosition(ok, fail) { success=ok; failure=fail; return 1; }});
  success({coords:{latitude:10.76,longitude:78.81,accuracy:5}});
  failure({code:2});
  assert.equal(context.origins.length, 1);
  context.state.mapRoute = {venueId:2,origin:null};
  failure({code:1});
  assert.equal(context.origins.length, 1);
});
