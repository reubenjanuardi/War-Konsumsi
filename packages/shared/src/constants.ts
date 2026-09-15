export const PARTICIPANT_NAME_MIN_LENGTH = 2;
export const PARTICIPANT_NAME_MAX_LENGTH = 100;
export const DEFAULT_LIMITED_QUOTA_THRESHOLD = 3;

export const SOCKET_EVENTS = {
  JOIN_EVENT: 'event.join',
  LEAVE_EVENT: 'event.leave',
  CATEGORY_QUOTA_UPDATED: 'category.quota.updated',
  EVENT_STATUS_UPDATED: 'event.status.updated',
} as const;

