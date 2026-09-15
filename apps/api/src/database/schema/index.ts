import { pgTable, uuid, varchar, text, integer, boolean, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
  selectionStartsAt: timestamp('selection_starts_at', { withTimezone: true }).notNull(),
  selectionEndsAt: timestamp('selection_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('chk_events_status', sql`${table.status} IN ('DRAFT', 'WAITING', 'OPEN', 'CLOSED')`),
]);

export const participants = pgTable('participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_participants_event_id').on(table.eventId),
]);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  quota: integer('quota').notNull(),
  remainingQuota: integer('remaining_quota').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('chk_categories_quota_positive', sql`${table.quota} >= 0`),
  check('chk_categories_remaining_quota_positive', sql`${table.remainingQuota} >= 0`),
  check('chk_categories_remaining_quota_lte_quota', sql`${table.remainingQuota} <= ${table.quota}`),
  index('idx_categories_event_active').on(table.eventId, table.isActive),
]);

export const selections = pgTable('selections', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_selections_event_participant').on(table.eventId, table.participantId),
  index('idx_selections_category_id').on(table.categoryId),
]);
