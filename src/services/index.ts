/**
 * Services layer barrel.
 *
 * Data-access modules that receive their dependencies (`SupabaseClient`, `Cache`)
 * via constructor injection (Requirement 1.5, 5.4). Populated by later tasks
 * (3.x, 8.x, 9.x).
 */
export type { SupabaseClient, PreferHeader, SupabaseClientConfig } from './supabase-client';
export { RestSupabaseClient, createSupabaseClient } from './supabase-client';
export { UserService } from './user.service';
export { SquadService } from './squad.service';
export { UserProfileService } from './user-profile.service';
export { FixtureService } from './fixture.service';
export { ScoreService, PERMANENT_DUPLICATE_MESSAGE } from './score.service';
export {
  PredictionService,
  DEFAULT_PREDICTION_CONFIG,
  PREDICTION_LOCKED_MESSAGE,
  FIXTURE_NOT_FOUND_MESSAGE,
} from './prediction.service';
export { AchievementService, ACHIEVEMENT_CATALOG } from './achievement.service';
export { CraqueService } from './craque.service';
export { FanScoreService, DEFAULT_FAN_SCORE_CONFIG } from './fan-score.service';
export type { FanScoreResult } from './fan-score.service';
export type { AuthService, Session, Unsubscribe, SessionStorageLike } from './auth.service';
export { LocalAuthService } from './auth.service';
export {
  requestReminderPermission,
  scheduleFixtureReminder,
  cancelReminders,
  DEFAULT_REMINDER_LEAD_MS,
} from './reminders';
