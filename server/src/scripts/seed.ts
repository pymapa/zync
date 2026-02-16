/**
 * Seed script - Inserts dummy data into the database for testing
 * Run with: npx ts-node src/scripts/seed.ts
 */

import path from 'path';
import { initDatabase, getDatabase, closeDatabase } from '../services/database';

const ACTIVITY_TYPES = ['Run', 'Ride', 'Swim', 'Walk', 'Hike', 'TrailRun', 'MountainBikeRide', 'Workout'];

const ACTIVITY_NAMES = {
  Run: ['Morning Run', 'Evening Jog', 'Tempo Run', 'Long Run', 'Recovery Run', 'Interval Training'],
  Ride: ['Morning Ride', 'Weekend Cycling', 'Commute', 'Hill Climb', 'Group Ride'],
  Swim: ['Pool Swim', 'Open Water Swim', 'Swim Drills', 'Endurance Swim'],
  Walk: ['Morning Walk', 'Evening Stroll', 'Lunch Break Walk'],
  Hike: ['Mountain Hike', 'Forest Trail', 'Weekend Adventure'],
  TrailRun: ['Trail Run', 'Forest Run', 'Hill Repeats'],
  MountainBikeRide: ['MTB Session', 'Trail Riding', 'Downhill Fun'],
  Workout: ['Gym Session', 'Strength Training', 'CrossFit', 'HIIT'],
};

// Helsinki area coordinates
const HELSINKI_CENTER = { lat: 60.1699, lng: 24.9384 };

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateLocation(center: { lat: number; lng: number }, radiusKm: number) {
  const radiusDeg = radiusKm / 111; // Roughly 111km per degree
  const lat = center.lat + randomInRange(-radiusDeg, radiusDeg);
  const lng = center.lng + randomInRange(-radiusDeg * 1.5, radiusDeg * 1.5); // Longitude wider at this latitude
  return { lat, lng };
}

function generateActivity(id: number, userId: number, daysAgo: number) {
  const type = randomChoice(ACTIVITY_TYPES);
  const names = ACTIVITY_NAMES[type as keyof typeof ACTIVITY_NAMES] || ['Activity'];
  const name = randomChoice(names);

  const startLocation = generateLocation(HELSINKI_CENTER, 15);
  const endLocation = generateLocation(startLocation, 2);

  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(Math.floor(randomInRange(6, 20)), Math.floor(randomInRange(0, 59)), 0, 0);

  // Generate realistic values based on activity type
  let distance: number;
  let movingTime: number;
  let elevationGain: number;
  let avgHeartRate: number | null;
  let maxHeartRate: number | null;
  let avgCadence: number | null;
  let avgWatts: number | null;

  switch (type) {
    case 'Run':
    case 'TrailRun':
      distance = randomInRange(3000, 21000);
      movingTime = distance / randomInRange(2.5, 4.5); // 2.5-4.5 m/s pace
      elevationGain = randomInRange(20, 300);
      avgHeartRate = Math.floor(randomInRange(140, 170));
      maxHeartRate = avgHeartRate + Math.floor(randomInRange(10, 25));
      avgCadence = Math.floor(randomInRange(160, 185));
      avgWatts = null;
      break;

    case 'Ride':
    case 'MountainBikeRide':
      distance = randomInRange(15000, 80000);
      movingTime = distance / randomInRange(5, 10); // 18-36 km/h
      elevationGain = randomInRange(100, 1000);
      avgHeartRate = Math.floor(randomInRange(130, 160));
      maxHeartRate = avgHeartRate + Math.floor(randomInRange(15, 35));
      avgCadence = Math.floor(randomInRange(70, 100));
      avgWatts = Math.floor(randomInRange(150, 280));
      break;

    case 'Swim':
      distance = randomInRange(1000, 4000);
      movingTime = distance / randomInRange(1.0, 1.8); // 1.0-1.8 m/s
      elevationGain = 0;
      avgHeartRate = Math.floor(randomInRange(120, 150));
      maxHeartRate = avgHeartRate + Math.floor(randomInRange(10, 20));
      avgCadence = null;
      avgWatts = null;
      break;

    case 'Walk':
    case 'Hike':
      distance = randomInRange(3000, 15000);
      movingTime = distance / randomInRange(1.2, 1.8); // 4-6.5 km/h
      elevationGain = type === 'Hike' ? randomInRange(100, 800) : randomInRange(10, 100);
      avgHeartRate = Math.floor(randomInRange(90, 130));
      maxHeartRate = avgHeartRate + Math.floor(randomInRange(10, 30));
      avgCadence = null;
      avgWatts = null;
      break;

    default:
      distance = randomInRange(0, 5000);
      movingTime = randomInRange(1800, 5400);
      elevationGain = 0;
      avgHeartRate = Math.floor(randomInRange(100, 150));
      maxHeartRate = avgHeartRate + Math.floor(randomInRange(10, 30));
      avgCadence = null;
      avgWatts = null;
  }

  const elapsedTime = movingTime + randomInRange(0, movingTime * 0.1); // Up to 10% rest time

  return {
    id,
    userId,
    name,
    type,
    distanceMeters: Math.round(distance),
    movingTimeSeconds: Math.round(movingTime),
    elapsedTimeSeconds: Math.round(elapsedTime),
    elevationGainMeters: Math.round(elevationGain),
    startDate: date.getTime(),
    startDateLocal: date.toISOString().replace('Z', ''),
    averageSpeed: distance / movingTime,
    maxSpeed: (distance / movingTime) * randomInRange(1.2, 1.5),
    averageHeartrate: avgHeartRate,
    maxHeartrate: maxHeartRate,
    calories: Math.round(movingTime / 60 * randomInRange(8, 15)),
    description: Math.random() > 0.7 ? `Great ${type.toLowerCase()} today! Felt strong.` : null,
    averageCadence: avgCadence,
    averageWatts: avgWatts,
    kudosCount: Math.floor(randomInRange(0, 25)),
    commentCount: Math.floor(randomInRange(0, 5)),
    summaryPolyline: null, // Would need real encoding
    startLatlng: JSON.stringify([startLocation.lat, startLocation.lng]),
    endLatlng: JSON.stringify([endLocation.lat, endLocation.lng]),
    startLat: startLocation.lat,
    startLng: startLocation.lng,
    endLat: endLocation.lat,
    endLng: endLocation.lng,
  };
}

async function seed() {
  console.log('Initializing database...');
  initDatabase(path.join(process.cwd(), 'data'));

  const db = getDatabase();

  // Create a test user's sync status
  const userId = 12345678; // Dummy Strava user ID

  console.log('Creating sync status...');
  let syncStatus = db.getSyncStatus(userId);
  if (!syncStatus) {
    syncStatus = db.createSyncStatus(userId);
  }

  // Generate activities for the last 3 years
  console.log('Generating activities...');
  const activities = [];
  let activityId = 1000000000;

  // Generate roughly 4-5 activities per week for 3 years ≈ 700 activities
  for (let daysAgo = 0; daysAgo < 365 * 3; daysAgo++) {
    // Random number of activities per day (0-2, weighted toward 0-1)
    const activitiesPerDay = Math.random() > 0.4 ? (Math.random() > 0.7 ? 2 : 1) : 0;

    for (let i = 0; i < activitiesPerDay; i++) {
      activities.push(generateActivity(activityId++, userId, daysAgo));
    }
  }

  console.log(`Generated ${activities.length} activities`);

  // Insert in batches
  console.log('Inserting activities...');
  const batchSize = 100;
  for (let i = 0; i < activities.length; i += batchSize) {
    const batch = activities.slice(i, i + batchSize);
    db.upsertActivities(batch);
    process.stdout.write(`\rInserted ${Math.min(i + batchSize, activities.length)}/${activities.length}`);
  }
  console.log('\n');

  // Update sync status
  db.updateSyncStatus(userId, {
    syncState: 'completed',
    totalActivities: activities.length,
    lastActivityId: activities[0]?.id,
    lastSyncAt: Date.now(),
  });

  console.log('Seed completed!');
  console.log(`  User ID: ${userId}`);
  console.log(`  Activities: ${activities.length}`);

  const oldest = activities[activities.length - 1];
  const newest = activities[0];
  if (oldest && newest) {
    console.log(`  Date range: ${new Date(oldest.startDate).toLocaleDateString()} - ${new Date(newest.startDate).toLocaleDateString()}`);
  }

  closeDatabase();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
