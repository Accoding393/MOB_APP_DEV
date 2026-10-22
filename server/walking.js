export function validPoint(point) {
  return point && typeof point.latitude === 'number' && typeof point.longitude === 'number'
    && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export async function walkingRoute(origin, destination) {
  if (!process.env.ORS_API_KEY) {
    return roadRoutePreview(origin, destination);
  }
  const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: process.env.ORS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]] })
  });
  if (!response.ok) throw new Error('Walking directions are temporarily unavailable. Please try again.');
  const data = await response.json();
  const route = data.features?.[0];
  if (!route?.geometry?.coordinates?.length) throw new Error('No mapped walking path connects these locations.');
  return {
    mode: 'walking',
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    distanceKm: route.properties.summary.distance / 1000,
    timeMinutes: Math.ceil(route.properties.summary.duration / 60),
    steps: route.properties.segments.flatMap(segment => segment.steps).map(step => ({
      instruction: step.instruction, distance: step.distance, pointIndex: step.way_points[0]
    }))
  };
}

// Preserve the website's original keyless routing. OSRM's public driving
// profile is a road preview, not a verified pedestrian route.
async function roadRoutePreview(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true&radiuses=unlimited;unlimited`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Route service is temporarily unavailable. Please try again.');
  const data = await response.json();
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route?.geometry?.coordinates?.length) throw new Error('No mapped road route could be found.');
  return {
    mode: 'road-preview',
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    distanceKm: route.distance / 1000,
    timeMinutes: null,
    steps: [],
    note: 'Road route preview. Pedestrian access and shortcuts are not verified.'
  };
}
