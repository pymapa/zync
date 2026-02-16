/**
 * Geohash encoding/decoding utilities
 *
 * Geohash is a hierarchical spatial data structure that subdivides space into buckets.
 * Precision levels:
 *   1: ~5000km  (continent)
 *   2: ~1250km  (large region)
 *   3: ~156km   (country/state)
 *   4: ~39km    (city)
 *   5: ~5km     (neighborhood)
 *   6: ~1.2km   (street)
 *   7: ~153m    (block)
 *   8: ~38m     (building)
 *   9: ~5m      (precise)
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode latitude/longitude to geohash string
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @param precision Number of characters (1-12), default 7 (~153m)
 */
export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch = ch << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode geohash to bounding box
 * Returns { minLat, maxLat, minLng, maxLng }
 */
export function decodeGeohashBounds(hash: string): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isLng = true;

  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) throw new Error(`Invalid geohash character: ${c}`);

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;
      if (isLng) {
        const mid = (lngMin + lngMax) / 2;
        if (bitValue) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitValue) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isLng = !isLng;
    }
  }

  return { minLat: latMin, maxLat: latMax, minLng: lngMin, maxLng: lngMax };
}

/**
 * Decode geohash to center point
 */
export function decodeGeohash(hash: string): { lat: number; lng: number } {
  const bounds = decodeGeohashBounds(hash);
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

/**
 * Get all 8 neighboring geohashes
 */
export function getGeohashNeighbors(hash: string): string[] {
  const { lat, lng } = decodeGeohash(hash);
  const bounds = decodeGeohashBounds(hash);
  const latDelta = bounds.maxLat - bounds.minLat;
  const lngDelta = bounds.maxLng - bounds.minLng;

  const neighbors: string[] = [];
  const directions: [number, number][] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  for (const [dLat, dLng] of directions) {
    const newLat = lat + dLat * latDelta;
    const newLng = lng + dLng * lngDelta;
    if (newLat >= -90 && newLat <= 90 && newLng >= -180 && newLng <= 180) {
      neighbors.push(encodeGeohash(newLat, newLng, hash.length));
    }
  }

  return neighbors;
}

/**
 * Get geohash prefixes that cover a bounding box
 * Useful for querying activities within an area
 */
export function getGeohashesForBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  precision = 5
): string[] {
  const hashes = new Set<string>();

  // Sample points within the bounding box
  const latStep = (maxLat - minLat) / 4;
  const lngStep = (maxLng - minLng) / 4;

  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lng = minLng; lng <= maxLng; lng += lngStep) {
      hashes.add(encodeGeohash(lat, lng, precision));
    }
  }

  // Add corner points
  hashes.add(encodeGeohash(minLat, minLng, precision));
  hashes.add(encodeGeohash(minLat, maxLng, precision));
  hashes.add(encodeGeohash(maxLat, minLng, precision));
  hashes.add(encodeGeohash(maxLat, maxLng, precision));

  return Array.from(hashes);
}
