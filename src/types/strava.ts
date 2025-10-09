// Strava API Type Definitions
type Callback<T = unknown> = (error: Error | null, payload: T) => void;

interface BaseArgs {
  access_token?: string;
  responseType?: string;
}

interface ApplicationBaseArgs {
  client_id: string;
  client_secret: string;
}

export interface PushSubscriptionRoutes {
  list(done?: Callback): Promise<ListPushSubscriptionResponse[]>;
  create(
    args: CreatePushSubscriptionRouteArgs,
    done?: Callback
  ): Promise<CreatePushSubscriptionResponse>;
  delete(args: DeletePushSubscriptionRouteArgs, done?: Callback): Promise<void>;
}

export interface ListPushSubscriptionResponse {
  id: number;
  resource_state: number;
  application_id: number;
  callback_url: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePushSubscriptionResponse {
  id: number;
}

export interface CreatePushSubscriptionRouteArgs extends ApplicationBaseArgs {
  callback_url: string;
  verify_token: string;
}

export interface DeletePushSubscriptionRouteArgs extends ApplicationBaseArgs {
  id: string;
}

export interface UploadsRoutes {
  post(args: UploadRouteArgs, done?: Callback): Promise<UploadResponse>;
}

export interface UploadRouteArgs {
  file: Buffer;
  name: string;
  description?: string;
  trainer?: string;
  commute?: string;
  data_type: string;
  external_id: string;
}

export interface UploadResponse {
  id: string;
  id_str?: string;
  external_id?: string;
  error?: string;
  status?: string;
  activity_id?: string;
}

export interface SegmentArgs extends BaseArgs {
  id: string;
  page?: number;
  per_page?: number;
}

export interface SegmentExploreArgs extends BaseArgs {
  bounds: [number, number, number, number]; // [sw_lat, sw_lng, ne_lat, ne_lng]
  activity_type?: 'running' | 'riding';
}

export interface SegmentResponse {
  id: string;
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
  city: string;
  state: string;
  country: string;
  private: boolean;
  starred: boolean;
}

export interface SegmentsRoutes {
  get(args: SegmentArgs, done?: Callback<SegmentResponse>): Promise<SegmentResponse>;
  listStarred(args: BaseArgs & { page?: number; per_page?: number }, done?: Callback<SegmentResponse[]>): Promise<SegmentResponse[]>;
  listEfforts(args: SegmentArgs, done?: Callback<SegmentEffortResponse[]>): Promise<SegmentEffortResponse[]>;
  listLeaderboard(args: SegmentArgs, done?: Callback<LeaderboardResponse>): Promise<LeaderboardResponse>;
  explore(args: SegmentExploreArgs, done?: Callback<SegmentResponse[]>): Promise<SegmentResponse[]>;
}

export interface SegmentEffortResponse {
  id: string;
  resource_state: number;
  name: string;
  activity: { id: string };
  athlete: { id: string };
  elapsed_time: number;
  moving_time: number;
  start_date: Date;
  start_date_local: Date;
  distance: number;
  start_index: number;
  end_index: number;
}

export interface LeaderboardResponse {
  effort_count: number;
  entry_count: number;
  entries: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  athlete_name: string;
  athlete_id: string;
  elapsed_time: number;
  moving_time: number;
  start_date: Date;
  start_date_local: Date;
  rank: number;
}

export interface SegmentEffortsRoutes {
  get(args: { id: string } & BaseArgs, done?: Callback<SegmentEffortResponse>): Promise<SegmentEffortResponse>;
}

export interface StreamArgs extends BaseArgs {
  id: string;
  types: string[]; // e.g., ['time', 'latlng', 'distance', 'altitude', 'heartrate', 'watts']
  resolution?: 'low' | 'medium' | 'high';
}

export interface StreamResponse {
  type: string;
  data: number[] | [number, number][];
  series_type: string;
  original_size: number;
  resolution: string;
}

export interface StreamsRoutes {
  activity(args: StreamArgs, done?: Callback<StreamResponse[]>): Promise<StreamResponse[]>;
  effort(args: StreamArgs, done?: Callback<StreamResponse[]>): Promise<StreamResponse[]>;
  segment(args: StreamArgs, done?: Callback<StreamResponse[]>): Promise<StreamResponse[]>;
}

export interface RouteResponse {
  id: string;
  name: string;
  description: string;
  distance: number;
  elevation_gain: number;
  map: PolylineMapResponse;
  type: number;
  sub_type: number;
  private: boolean;
  starred: boolean;
  timestamp: number;
}

export interface RoutesRoutes {
  get(args: DetailRoute, done?: Callback<RouteResponse>): Promise<RouteResponse>;
  getFile(args: RouteFile, done?: Callback<string>): Promise<string>;
}

export interface DetailRoute extends BaseArgs {
  id: string;
}

export interface RouteFile extends BaseArgs {
  id: string;
  file_type: string;
}

export interface GearResponse {
  id: string;
  resource_state: number;
  primary: boolean;
  name: string;
  distance: number;
  brand_name?: string;
  model_name?: string;
  frame_type?: number;
  description?: string;
}

export interface GearRoutes {
  get(args: { id: string } & BaseArgs, done?: Callback<GearResponse>): Promise<GearResponse>;
}

export interface RunningRaceResponse {
  id: string;
  name: string;
  running_race_type: number;
  distance: number;
  start_date_local: Date;
  city: string;
  state: string;
  country: string;
  route_ids: string[];
  measurement_preference: string;
  url: string;
  website_url: string;
}

export interface RunningRacesRoutes {
  get(args: { id: string } & BaseArgs, done?: Callback<RunningRaceResponse>): Promise<RunningRaceResponse>;
  listRaces(args: BaseArgs & { year?: number }, done?: Callback<RunningRaceResponse[]>): Promise<RunningRaceResponse[]>;
}

export interface ClubResponse {
  id: string;
  resource_state: number;
  name: string;
  profile_medium: string;
  profile: string;
  cover_photo: string;
  cover_photo_small: string;
  sport_type: SportType;
  city: string;
  state: string;
  country: string;
  private: boolean;
  member_count: number;
  featured: boolean;
  verified: boolean;
  url: string;
}

export interface ClubMemberResponse {
  resource_state: number;
  firstname: string;
  lastname: string;
  member_status: string;
}

export interface ClubAnnouncementResponse {
  id: string;
  resource_state: number;
  club_id: string;
  athlete: AthleteResponse;
  created_at: Date;
  message: string;
}

export interface ClubEventResponse {
  id: string;
  resource_state: number;
  title: string;
  description: string;
  club_id: string;
  organizing_athlete: AthleteResponse;
  activity_type: string;
  created_at: Date;
  route_id?: string;
  woman_only: boolean;
  private: boolean;
  skill_levels: number;
  terrain: number;
  upcoming_occurrences: Date[];
}

export interface ClubsRoutes {
  get(args: ClubsRoutesArgs, done?: Callback<ClubResponse>): Promise<ClubResponse>;
  listMembers(args: ClubsRoutesListArgs, done?: Callback<ClubMemberResponse[]>): Promise<ClubMemberResponse[]>;
  listActivities(
    args: ClubsRoutesListArgs,
    done?: Callback<ClubActivity[]>
  ): Promise<ClubActivity[]>;
  listAnnouncements(args: ClubsRoutesListArgs, done?: Callback<ClubAnnouncementResponse[]>): Promise<ClubAnnouncementResponse[]>;
  listEvents(args: ClubsRoutesListArgs, done?: Callback<ClubEventResponse[]>): Promise<ClubEventResponse[]>;
  listAdmins(args: ClubsRoutesListArgs, done?: Callback<AthleteResponse[]>): Promise<AthleteResponse[]>;
  joinClub(args: ClubsRoutesListArgs, done?: Callback<ClubMemberResponse>): Promise<ClubMemberResponse>;
  leaveClub(args: ClubsRoutesListArgs, done?: Callback<ClubMemberResponse>): Promise<ClubMemberResponse>;
}

export interface ClubsRoutesArgs extends BaseArgs {
  id: string;
}

export interface ClubsRoutesListArgs extends ClubsRoutesArgs {
  page?: number;
  per_page?: number;
}

export interface ClubActivity {
  resource_state: number;
  athlete: {
    resource_state: number;
    firstname: string;
    lastname: string;
  };
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  workout_type?: number | null;
}

export interface AthleteStatsResponse {
  biggest_ride_distance: number;
  biggest_climb_elevation_gain: number;
  recent_ride_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
    achievement_count: number;
  };
  recent_run_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
    achievement_count: number;
  };
  recent_swim_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
    achievement_count: number;
  };
  ytd_ride_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  ytd_run_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  ytd_swim_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  all_ride_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  all_run_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  all_swim_totals: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
}

export interface AthletesRoutes {
  get(args: AthleteRouteArgs, done?: Callback<AthleteRouteResponse>): Promise<AthleteRouteResponse>;
  stats(args: { id: string } & BaseArgs, done?: Callback<AthleteStatsResponse>): Promise<AthleteStatsResponse>;
}

export interface AthleteRouteArgs extends BaseArgs {
  athlete_id: string;
  page?: number;
  offset?: number;
}

export interface AthleteRouteResponse {
  athlete: AthleteResponse;
  description?: string;
  distance?: number;
  elevation_gain?: number;
  id: string;
  id_str?: string;
  map?: PolylineMapResponse;
  name?: string;
  private: boolean;
  starred?: boolean;
  timestamp?: number;
  type?: number;
  sub_type?: number;
  created_at: Date;
  updated_at: Date;
  estimated_moving_time?: number;
  segments?: SegmentResponse[];
}

export interface AthleteResponse {
  id: string;
  resource_state?: number;
  firstname?: string;
  lastname?: string;
  profile_medium?: string;
  profile?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  premium?: boolean;
  summit?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PolylineMapResponse {
  id: string;
  polyline: string;
  summary_polyline: string;
}

type SportType =
  | "AlpineSki"
  | "BackcountrySki"
  | "Canoeing"
  | "Crossfit"
  | "EBikeRide"
  | "Elliptical"
  | "EMountainBikeRide"
  | "Golf"
  | "GravelRide"
  | "Handcycle"
  | "Hike"
  | "IceSkate"
  | "InlineSkate"
  | "Kayaking"
  | "Kitesurf"
  | "MountainBikeRide"
  | "NordicSki"
  | "Ride"
  | "RockClimbing"
  | "RollerSki"
  | "Rowing"
  | "Run"
  | "Sail"
  | "Skateboard"
  | "Snowboard"
  | "Snowshoe"
  | "Soccer"
  | "StairStepper"
  | "StandUpPaddling"
  | "Surfing"
  | "Swim"
  | "TrailRun"
  | "Velomobile"
  | "VirtualRide"
  | "VirtualRun"
  | "Walk"
  | "WeightTraining"
  | "Wheelchair"
  | "Windsurf"
  | "Workout"
  | "Yoga";

export interface DetailedActivityResponse {
  id: string;
  athlete: {
    resource_state: number;
    firstname: string;
    lastname: string;
  };
  name: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  elev_high?: number;
  elev_low?: number;
  sport_type: SportType;
  start_date: Date;
  start_date_local: Date;
  timezone?: string;
  utc_offset?: number;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  achievement_count?: number;
  kudos_count?: number;
  comment_count?: number;
  athlete_count?: number;
  photo_count?: number;
  total_photo_count?: number;
  map?: PolylineMapResponse;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  flagged?: boolean;
  average_speed?: number;
  max_speed?: number;
  has_kudoed?: boolean;
  hide_from_home?: boolean;
  gear_id?: string;
  description?: string;
  calories?: number;
  private_notes?: string;
  start_latlng?: Array<number>;
  end_latlng?: Array<number>;
}

export interface CreateActivityArgs extends BaseArgs {
  name: string;
  sport_type: SportType;
  start_date_local: Date;
  elapsed_time: number;
  type?: string;
  description?: string;
  distance?: number;
  trainer?: boolean;
  commute?: boolean;
}

export interface UpdateActivityArgs extends BaseArgs {
  id: string;
  name?: string;
  sport_type?: SportType;
  description?: string;
  trainer?: boolean;
  commute?: boolean;
  gear_id?: string;
}

export interface ListActivitiesArgs extends BaseArgs {
  before?: number;
  after?: number;
  page?: number;
  per_page?: number;
}

export interface ZoneResponse {
  score: number;
  distribution_buckets: Array<{
    min: number;
    max: number;
    time: number;
  }>;
  type: string;
  sensor_based: boolean;
  points: number;
  custom_zones: boolean;
  max: number;
}

export interface LapResponse {
  id: string;
  resource_state: number;
  name: string;
  activity: { id: string };
  athlete: { id: string };
  elapsed_time: number;
  moving_time: number;
  start_date: Date;
  start_date_local: Date;
  distance: number;
  start_index: number;
  end_index: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  lap_index: number;
}

export interface CommentResponse {
  id: string;
  activity_id: string;
  text: string;
  athlete: AthleteResponse;
  created_at: Date;
}

export interface KudoResponse {
  firstname: string;
  lastname: string;
}

export interface PhotoResponse {
  id: string;
  unique_id: string;
  urls: Record<string, string>;
  source: number;
  uploaded_at: Date;
  created_at: Date;
  caption: string;
}

export interface ActivitiesRoutes {
  get(args: { id: string } & BaseArgs, done?: Callback<DetailedActivityResponse>): Promise<DetailedActivityResponse>;
  create(args: CreateActivityArgs, done?: Callback<DetailedActivityResponse>): Promise<DetailedActivityResponse>;
  update(args: UpdateActivityArgs, done?: Callback<DetailedActivityResponse>): Promise<DetailedActivityResponse>;
  listFriends(args: ListActivitiesArgs, done?: Callback<DetailedActivityResponse[]>): Promise<DetailedActivityResponse[]>;
  listZones(args: { id: string } & BaseArgs, done?: Callback<ZoneResponse[]>): Promise<ZoneResponse[]>;
  listLaps(args: { id: string } & BaseArgs, done?: Callback<LapResponse[]>): Promise<LapResponse[]>;
  listComments(args: { id: string } & BaseArgs & { page?: number; per_page?: number }, done?: Callback<CommentResponse[]>): Promise<CommentResponse[]>;
  listKudos(args: { id: string } & BaseArgs & { page?: number; per_page?: number }, done?: Callback<KudoResponse[]>): Promise<KudoResponse[]>;
  listPhotos(args: { id: string } & BaseArgs & { size?: number }, done?: Callback<PhotoResponse[]>): Promise<PhotoResponse[]>;
  listRelated(args: { id: string } & BaseArgs & { page?: number; per_page?: number }, done?: Callback<DetailedActivityResponse[]>): Promise<DetailedActivityResponse[]>;
}

export interface UpdateAthleteArgs extends BaseArgs {
  weight?: number;
}

export interface DetailedAthleteResponse extends AthleteResponse {
  follower_count: number;
  friend_count: number;
  measurement_preference: string;
  ftp: number;
  weight: number;
  clubs: ClubResponse[];
  bikes: GearResponse[];
  shoes: GearResponse[];
}

export interface AthleteRoutes {
  get(args: BaseArgs, done?: Callback<DetailedAthleteResponse>): Promise<DetailedAthleteResponse>;
  update(args: UpdateAthleteArgs, done?: Callback<DetailedAthleteResponse>): Promise<DetailedAthleteResponse>;
  listActivities(args: ListActivitiesArgs, done?: Callback<DetailedActivityResponse[]>): Promise<DetailedActivityResponse[]>;
  listRoutes(args: BaseArgs & { page?: number; per_page?: number }, done?: Callback<RouteResponse[]>): Promise<RouteResponse[]>;
  listClubs(args: BaseArgs, done?: Callback<ClubResponse[]>): Promise<ClubResponse[]>;
  listZones(args: BaseArgs, done?: Callback<ZoneResponse[]>): Promise<ZoneResponse[]>;
}

export interface OAuthRequestArgs {
  scope: string;
}

export interface TokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: AthleteResponse;
}

export interface DeauthorizeResponse {
  access_token: string;
}

export interface OAuthRoutes {
  getRequestAccessURL(args: OAuthRequestArgs): string;
  getToken(code: string, done?: Callback<TokenResponse>): Promise<TokenResponse>;
  refreshToken(code: string): Promise<RefreshTokenResponse>;
  deauthorize(args: BaseArgs, done?: Callback<DeauthorizeResponse>): Promise<DeauthorizeResponse>;
}

export interface RefreshTokenResponse {
  token_type: string;
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
}

export interface RateLimiting {
  exceeded(): boolean;
  fractionReached(): number;
}

export interface AuthenticationConfig {
  access_token: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface Strava {
  config(config: AuthenticationConfig): void;
  client(token: string): void;
  athlete: AthleteRoutes;
  athletes: AthletesRoutes;
  activities: ActivitiesRoutes;
  clubs: ClubsRoutes;
  gear: GearRoutes;
  segments: SegmentsRoutes;
  segmentEfforts: SegmentEffortsRoutes;
  pushSubscriptions: PushSubscriptionRoutes;
  streams: StreamsRoutes;
  uploads: UploadsRoutes;
  rateLimiting: RateLimiting;
  runningRaces: RunningRacesRoutes;
  routes: RoutesRoutes;
  oauth: OAuthRoutes;
}

declare const strava: Strava;
export default strava;