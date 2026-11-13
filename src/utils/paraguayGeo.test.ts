import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferParaguayDepartmentFromCity,
  formatFullCityDepartment,
  extractLatLngFromGoogleMapsUrl,
  normalizeOrderGpsFields,
  buildGoogleMapsSearchUrl
} from './paraguayGeo';

test('inferParaguayDepartmentFromCity resolves departments reliably from Paraguayan cities', () => {
  assert.equal(inferParaguayDepartmentFromCity('Coronel oviedo', ''), 'Caaguazú');
  assert.equal(inferParaguayDepartmentFromCity('Ciudad del Este', ''), 'Alto Paraná');
  assert.equal(inferParaguayDepartmentFromCity('San Antonio', ''), 'Central');
  assert.equal(inferParaguayDepartmentFromCity('Asunción', ''), 'Asunción (Capital)');
  assert.equal(inferParaguayDepartmentFromCity('Encarnación', ''), 'Itapúa');
  assert.equal(inferParaguayDepartmentFromCity('San Lorenzo', 'Sin especificar'), 'Central');
});

test('formatFullCityDepartment avoids trailing commas and avoids duplicate city-department text', () => {
  assert.equal(formatFullCityDepartment('Coronel oviedo', ''), 'Coronel oviedo, Caaguazú');
  assert.equal(formatFullCityDepartment('San Antonio', 'Central'), 'San Antonio, Central');
  assert.equal(formatFullCityDepartment('Asunción', 'Asunción (Capital)'), 'Asunción (Capital)');
  assert.equal(formatFullCityDepartment('Central', 'Central'), 'Central');
  assert.equal(formatFullCityDepartment('', ''), 'Sin ciudad');
});

test('extractLatLngFromGoogleMapsUrl parses coordinates across common Google Maps formats', () => {
  assert.deepEqual(extractLatLngFromGoogleMapsUrl('https://www.google.com/maps?q=-25.450055,-56.440699'), {
    lat: -25.450055,
    lng: -56.440699
  });
  assert.deepEqual(extractLatLngFromGoogleMapsUrl('https://www.google.com/maps/@-25.516901,-54.616864,15z'), {
    lat: -25.516901,
    lng: -54.616864
  });
  assert.equal(extractLatLngFromGoogleMapsUrl('https://maps.app.goo.gl/abc123'), null);
});

test('normalizeOrderGpsFields normalizes snake_case, string coords, dispositivo fallback, and honest gpsConfirmado', () => {
  const fromSnake = normalizeOrderGpsFields({
    gps_lat: '-25.3001',
    gps_lng: '-57.5802',
    gps_confirmado: true,
    gpsFuente: 'gps_dispositivo'
  });
  assert.equal(fromSnake.gpsLat, -25.3001);
  assert.equal(fromSnake.gpsLng, -57.5802);
  assert.equal(fromSnake.gpsLink, 'https://www.google.com/maps?q=-25.300100,-57.580200');
  assert.equal(fromSnake.gpsConfirmado, true);
  assert.equal(fromSnake.gpsFuente, 'gps_dispositivo');

  // Honest address geocoding fallback: has link & coords, keeps gpsConfirmado=false
  const approxFromFallback = normalizeOrderGpsFields(
    { gps_lat: null, gps_lng: null, gps_link: null, gps_confirmado: false },
    {
      gpsLat: -25.411516,
      gpsLng: -57.575826,
      gpsLink: 'https://www.google.com/maps?q=-25.411516,-57.575826',
      gpsConfirmado: false,
      gpsFuente: 'geocodificacion_direccion'
    }
  );
  assert.equal(approxFromFallback.gpsLat, -25.411516);
  assert.equal(approxFromFallback.gpsLng, -57.575826);
  assert.equal(approxFromFallback.gpsLink, 'https://www.google.com/maps?q=-25.411516,-57.575826');
  assert.equal(approxFromFallback.gpsConfirmado, false);
  assert.equal(approxFromFallback.gpsFuente, 'geocodificacion_direccion');

  // Extract coordinates from link when numeric columns are missing
  const fromLinkOnly = normalizeOrderGpsFields({
    gps_link: 'https://www.google.com/maps?q=-25.450055,-56.440699',
    gps_confirmado: true
  });
  assert.equal(fromLinkOnly.gpsLat, -25.450055);
  assert.equal(fromLinkOnly.gpsLng, -56.440699);
  assert.equal(fromLinkOnly.gpsConfirmado, true);
});

test('buildGoogleMapsSearchUrl builds usable search URLs from Order direccion/ciudad', () => {
  const url = buildGoogleMapsSearchUrl({
    direccion: 'Barrio Ciudad nueva, San miguel [GPS: https://www.google.com/maps?q=-25.4,-56.4]',
    ciudad: 'Coronel oviedo',
    departamento: ''
  });
  assert.ok(url);
  assert.ok(url!.includes('maps/search/?api=1&query='));
  assert.ok(decodeURIComponent(url!).includes('Barrio Ciudad nueva, San miguel, Coronel oviedo, Caaguazú, Paraguay'));
  assert.ok(!decodeURIComponent(url!).includes('[GPS:'));
});
