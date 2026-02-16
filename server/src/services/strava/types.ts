/**
 * Strava API type definitions
 */

// OAuth Token Response
export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: StravaAthlete;
}

// Athlete
export interface StravaAthlete {
  id: number;
  username: string | null;
  resource_state: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  sex: string | null;
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  badge_type_id: number;
  weight: number | null;
  profile_medium: string;
  profile: string;
  friend: null;
  follower: null;
}

// Activity
export interface StravaActivity {
  id: number;
  resource_state: number;
  external_id: string | null;
  upload_id: number | null;
  athlete: {
    id: number;
    resource_state: number;
  };
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  workout_type: number | null;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    id: string;
    summary_polyline: string | null;
    resource_state: number;
  };
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  visibility: string;
  flagged: boolean;
  gear_id: string | null;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  average_speed: number;
  max_speed: number;
  average_cadence: number | null;
  average_watts: number | null;
  weighted_average_watts: number | null;
  kilojoules: number | null;
  device_watts: boolean;
  has_heartrate: boolean;
  average_heartrate: number | null;
  max_heartrate: number | null;
  heartrate_opt_out: boolean;
  display_hide_heartrate_option: boolean;
  elev_high: number | null;
  elev_low: number | null;
  upload_id_str: string | null;
  external_id_str: string | null;
  from_accepted_tag: boolean;
  pr_count: number;
  total_photo_count: number;
  has_kudoed: boolean;
}

// Detailed Activity (includes additional fields)
export interface StravaDetailedActivity extends StravaActivity {
  description: string | null;
  calories: number | null;
  device_name: string | null;
  embed_token: string | null;
  splits_metric: SplitMetric[];
  splits_standard: SplitStandard[];
  laps: Lap[];
  best_efforts: BestEffort[];
  segment_efforts: SegmentEffort[];
  photos: PhotosSummary;
  highlighted_kudosers: Kudoser[];
  gear: Gear | null;
  partner_brand_tag: string | null;
  available_zones: string[];
}

// Supporting types
export interface SplitMetric {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  pace_zone: number;
}

export interface SplitStandard {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  pace_zone: number;
}

export interface Lap {
  id: number;
  resource_state: number;
  name: string;
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  lap_index: number;
  split: number;
}

export interface BestEffort {
  id: number;
  resource_state: number;
  name: string;
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  pr_rank: number | null;
  achievements: unknown[];
}

export interface SegmentEffort {
  id: number;
  resource_state: number;
  name: string;
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  average_cadence: number | null;
  average_watts: number | null;
  device_watts: boolean;
  average_heartrate: number | null;
  max_heartrate: number | null;
  segment: Segment;
  kom_rank: number | null;
  pr_rank: number | null;
  achievements: unknown[];
  hidden: boolean;
}

export interface Segment {
  id: number;
  resource_state: number;
  name: string;
  activity_type: string;
  distance: number;
  average_grade: number;
  maximum_grade: number;
  elevation_high: number;
  elevation_low: number;
  start_latlng: [number, number];
  end_latlng: [number, number];
  climb_category: number;
  city: string | null;
  state: string | null;
  country: string | null;
  private: boolean;
  hazardous: boolean;
  starred: boolean;
}

export interface PhotosSummary {
  primary: Photo | null;
  use_primary_photo: boolean;
  count: number;
}

export interface Photo {
  id: number;
  unique_id: string;
  urls: Record<string, string>;
  source: number;
  uploaded_at: string;
  created_at: string;
  location: [number, number] | null;
}

export interface Kudoser {
  destination_url: string;
  display_name: string;
  avatar_url: string;
  show_name: boolean;
}

export interface Gear {
  id: string;
  primary: boolean;
  name: string;
  resource_state: number;
  distance: number;
}

// Streams
export interface StravaStream {
  type: string;
  resource_state: number;
  original_size: number;
  resolution: string;
  series_type: string;
  data: number[];
}

export type StravaStreamsResponse = Record<string, StravaStream>;

// Athlete Stats
export interface StravaAthleteStats {
  biggest_ride_distance: number | null;
  biggest_climb_elevation_gain: number | null;
  recent_ride_totals: ActivityTotals;
  recent_run_totals: ActivityTotals;
  recent_swim_totals: ActivityTotals;
  ytd_ride_totals: ActivityTotals;
  ytd_run_totals: ActivityTotals;
  ytd_swim_totals: ActivityTotals;
  all_ride_totals: ActivityTotals;
  all_run_totals: ActivityTotals;
  all_swim_totals: ActivityTotals;
}

export interface ActivityTotals {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
  achievement_count?: number;
}
