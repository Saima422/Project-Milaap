const POLICE_STATIONS = [
  { name: "Adgaon Police Station", lat: 20.015486, lng: 73.826945, zone: "Zone-1" },
  { name: "Ambad Police Station", lat: 19.96586, lng: 73.763443, zone: "Zone-2" },
  { name: "Bhadrakali Police Station", lat: 19.997799, lng: 73.789208, zone: "Zone-3" },
  { name: "Devlali Camp Police Station", lat: 19.905098, lng: 73.826855, zone: "Zone-4" },
  { name: "Gangapur Police Station", lat: 20.014267, lng: 73.75007, zone: "Zone-1" },
  { name: "Indiranagar Police Station", lat: 19.974576, lng: 73.778583, zone: "Zone-2" },
  { name: "Mhasrul Police Station", lat: 20.032542, lng: 73.802388, zone: "Zone-1" },
  { name: "Mumbai Naka Police Station", lat: 19.987591, lng: 73.783917, zone: "Zone-3" },
  { name: "Panchavati Police Station", lat: 20.015643, lng: 73.796739, zone: "Zone-1" },
  { name: "Sarkarwada Police Station", lat: 20.00562, lng: 73.779772, zone: "Zone-3" },
  { name: "Satpur Police Station", lat: 19.991434, lng: 73.742909, zone: "Zone-2" },
  { name: "Upnagar Police Station", lat: 19.967381, lng: 73.824402, zone: "Zone-4" },
  { name: "Nashik Road Police Station", lat: 19.9528351, lng: 73.8397366, zone: "Zone-4" },
  { name: "MIDC Chunchale Police Chowki", lat: 19.9506575, lng: 73.7368018, zone: "Zone-2" }
];

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function getBearingLabel(bearing) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

function getNearestStations(userLat, userLng, count = 3) {
  return POLICE_STATIONS
    .map(s => ({
      ...s,
      distance: getDistanceKm(userLat, userLng, s.lat, s.lng),
      bearing: getBearing(userLat, userLng, s.lat, s.lng),
      bearingLabel: getBearingLabel(getBearing(userLat, userLng, s.lat, s.lng))
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

function getStationsByZone(zone) {
  return POLICE_STATIONS.filter(s => s.zone === zone);
}

function getMapsUrl(destLat, destLng, destName) {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&destination_place_name=${encodeURIComponent(destName)}`;
}
