import type { SelectionDto } from '@war-konsumsi/shared';

const STORAGE_KEYS = {
  EVENT_ID: 'war_event_id',
  PARTICIPANT_ID: 'war_participant_id',
  PARTICIPANT_NAME: 'war_participant_name',
  SELECTION: 'war_selection',
} as const;

export const storage = {
  getParticipant(): { id: string; name: string } | null {
    if (typeof window === 'undefined') return null;
    const id = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_ID);
    const name = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_NAME);
    if (!id || !name) return null;
    return { id, name };
  },

  setParticipant(id: string, name: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.PARTICIPANT_ID, id);
    localStorage.setItem(STORAGE_KEYS.PARTICIPANT_NAME, name);
  },

  getSavedEventId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.EVENT_ID);
  },

  setEventId(eventId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.EVENT_ID, eventId);
  },

  getSelection(): SelectionDto | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.SELECTION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setSelection(selection: SelectionDto | null): void {
    if (typeof window === 'undefined') return;
    if (!selection) {
      localStorage.removeItem(STORAGE_KEYS.SELECTION);
    } else {
      localStorage.setItem(STORAGE_KEYS.SELECTION, JSON.stringify(selection));
    }
  },

  clearSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_NAME);
    localStorage.removeItem(STORAGE_KEYS.SELECTION);
  },
};
