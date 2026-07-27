export const LOCAL_RUN_LIMIT_DEFAULT = 1;
export const LOCAL_RUN_LIMIT_MAX = 3;
export const LOCAL_RUN_DELAY_MS_DEFAULT = 5000;
export const LOCAL_RUN_DELAY_MS_MAX = 60000;
export const LOCAL_RUN_DELAY_MS_MIN = 1000;
export const LOCAL_RUN_SESSION_JOB_LIMIT_DEFAULT = 100;
export const LOCAL_RUN_SESSION_JOB_LIMIT_MAX = 500;
export const LOCAL_RECENT_ITEM_LIMIT = 10;
export const LOCAL_REVIEW_LIMIT_DEFAULT = 12;
export const LOCAL_REVIEW_LIMIT_MAX = 50;
export const LOCAL_REVIEW_BULK_BATCH_SIZE = 100;
export const LOCAL_REVIEW_BULK_MAX_CANDIDATES = 20000;
export const LOCAL_ACCEPTED_PROCESSING_BATCH_DEFAULT = 25;
export const LOCAL_ACCEPTED_PROCESSING_BATCH_MAX = 50;
export const LOCAL_BENEFIT_DISCOVERY_LIMIT_DEFAULT = 20;
export const LOCAL_BENEFIT_DISCOVERY_LIMIT_MAX = 50;
export const LOCAL_BENEFIT_DISCOVERY_AUTOMATION_LIMIT_DEFAULT = 25;
export const LOCAL_BENEFIT_DISCOVERY_AUTOMATION_LIMIT_MAX = 50;
export const LOCAL_BENEFIT_DISCOVERY_AUTOMATION_ALL_MAX = 2000;
export const LOCAL_BENEFIT_DISCOVERY_SCORE_THRESHOLD_DEFAULT = 80;
export const LOCAL_BENEFIT_DISCOVERY_SCORE_THRESHOLD_MIN = 55;
export const LOCAL_BENEFIT_DISCOVERY_SCORE_THRESHOLD_MAX = 95;
export const LOCAL_IDENTITY_RESOLUTION_LIMIT_DEFAULT = 12;
export const LOCAL_IDENTITY_RESOLUTION_LIMIT_MAX = 50;
export const LOCAL_IDENTITY_RESOLUTION_AUTOMATION_LIMIT_DEFAULT = 100;
export const LOCAL_IDENTITY_RESOLUTION_AUTOMATION_LIMIT_MAX = 250;
export const LOCAL_IDENTITY_RESOLUTION_AUTOMATION_ALL_MAX = 2000;

export function normaliseRunLimit(value: unknown) {
  return normaliseLocalLimit(value, LOCAL_RUN_LIMIT_DEFAULT, LOCAL_RUN_LIMIT_MAX);
}

export function normaliseRunDelayMs(value: unknown) {
  return normaliseLocalLimit(
    value,
    LOCAL_RUN_DELAY_MS_DEFAULT,
    LOCAL_RUN_DELAY_MS_MAX,
    LOCAL_RUN_DELAY_MS_MIN
  );
}

export function normaliseRunSessionJobLimit(value: unknown) {
  return normaliseLocalLimit(
    value,
    LOCAL_RUN_SESSION_JOB_LIMIT_DEFAULT,
    LOCAL_RUN_SESSION_JOB_LIMIT_MAX
  );
}

export function normaliseAcceptedProcessingLimit(value: unknown) {
  return normaliseLocalLimit(
    value,
    LOCAL_ACCEPTED_PROCESSING_BATCH_DEFAULT,
    LOCAL_ACCEPTED_PROCESSING_BATCH_MAX
  );
}

export function normaliseBenefitDiscoveryLimit(
  value: unknown,
  maxValue = LOCAL_BENEFIT_DISCOVERY_LIMIT_MAX
) {
  return normaliseLocalLimit(
    value,
    LOCAL_BENEFIT_DISCOVERY_LIMIT_DEFAULT,
    maxValue
  );
}

export function normaliseBenefitDiscoveryAutomationLimit(value: unknown) {
  return normaliseLocalLimit(
    value,
    LOCAL_BENEFIT_DISCOVERY_AUTOMATION_LIMIT_DEFAULT,
    LOCAL_BENEFIT_DISCOVERY_AUTOMATION_LIMIT_MAX
  );
}

export function normaliseIdentityResolutionLimit(value: unknown) {
  return normaliseLocalLimit(
    value,
    LOCAL_IDENTITY_RESOLUTION_LIMIT_DEFAULT,
    LOCAL_IDENTITY_RESOLUTION_LIMIT_MAX
  );
}

export function normaliseIdentityResolutionAutomationLimit(value: unknown) {
  return normaliseLocalLimit(
    value,
    LOCAL_IDENTITY_RESOLUTION_AUTOMATION_LIMIT_DEFAULT,
    LOCAL_IDENTITY_RESOLUTION_AUTOMATION_LIMIT_MAX
  );
}

export function normaliseBenefitDiscoveryScoreThreshold(value: unknown) {
  return normaliseLocalLimit(
    value,
    LOCAL_BENEFIT_DISCOVERY_SCORE_THRESHOLD_DEFAULT,
    LOCAL_BENEFIT_DISCOVERY_SCORE_THRESHOLD_MAX,
    LOCAL_BENEFIT_DISCOVERY_SCORE_THRESHOLD_MIN
  );
}

export function normaliseReviewLimit(value: unknown) {
  return normaliseLocalLimit(value, LOCAL_REVIEW_LIMIT_DEFAULT, LOCAL_REVIEW_LIMIT_MAX);
}

function normaliseLocalLimit(value: unknown, defaultValue: number, maxValue: number, minValue = 1) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(maxValue, Math.max(minValue, Math.floor(parsed)));
}
