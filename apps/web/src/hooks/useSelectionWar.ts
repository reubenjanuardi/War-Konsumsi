'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  EventDetailDto,
  CategoryDto,
  SelectionDto,
  CategoryQuotaUpdatedPayload,
  EventStatusUpdatedPayload,
} from '@war-konsumsi/shared';
import { EventStatus } from '@war-konsumsi/shared';
import { api, ApiError } from '../lib/api';
import { storage } from '../lib/storage';
import { useSocket, type SocketStatus } from './useSocket';
import { useCountdown } from './useCountdown';

export type ParticipantFlowState =
  | 'LOADING'
  | 'JOIN'
  | 'WAITING_ROOM'
  | 'COUNTDOWN'
  | 'SELECTION'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'SELECTION_FAILED'
  | 'COMPLETED';

export interface UseSelectionWarResult {
  state: ParticipantFlowState;
  connectionStatus: SocketStatus;
  event: EventDetailDto | null;
  participant: { id: string; name: string } | null;
  categories: CategoryDto[];
  selection: SelectionDto | null;
  processingCategoryId: string | null;
  errorMessage: string | null;
  countdown: {
    hours: string;
    minutes: string;
    seconds: string;
    totalSeconds: number;
    isFinished: boolean;
    formatted: string;
  };
  joinEvent: (name: string) => Promise<void>;
  selectCategory: (categoryId: string) => Promise<void>;
  dismissError: () => void;
  resetSession: () => void;
}

export function useSelectionWar(targetEventId?: string | null): UseSelectionWarResult {
  const [state, setState] = useState<ParticipantFlowState>('LOADING');
  const [event, setEvent] = useState<EventDetailDto | null>(null);
  const [participant, setParticipant] = useState<{ id: string; name: string } | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selection, setSelection] = useState<SelectionDto | null>(null);
  const [processingCategoryId, setProcessingCategoryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load initial event and cached session
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        // 1. Fetch current event or target event
        const activeEvent = targetEventId
          ? await api.getEvent(targetEventId)
          : await api.getCurrentEvent();

        if (!isMounted) return;
        setEvent(activeEvent);
        storage.setEventId(activeEvent.id);

        // 2. Check cached participant in local storage
        const cachedParticipant = storage.getParticipant();

        if (!cachedParticipant) {
          setState('JOIN');
          return;
        }

        setParticipant(cachedParticipant);

        // 3. Authoritative check: has participant already selected in this event?
        try {
          const selectionCheck = await api.getParticipantSelection(
            activeEvent.id,
            cachedParticipant.id,
          );

          if (!isMounted) return;

          if (selectionCheck.hasSelected && selectionCheck.selection) {
            setSelection(selectionCheck.selection);
            storage.setSelection(selectionCheck.selection);
            setState('COMPLETED');
            return;
          }
        } catch {
          // If check fails (e.g. participant was from another event), reset to JOIN
          storage.clearSession();
          setParticipant(null);
          setState('JOIN');
          return;
        }

        // 4. Determine state based on event status
        const now = new Date(activeEvent.serverTime || Date.now());
        const startTime = new Date(activeEvent.selectionStartsAt);
        const isOpen = activeEvent.status === EventStatus.OPEN && now >= startTime;

        if (isOpen) {
          // Fetch categories
          const cats = await api.getCategories(activeEvent.id);
          if (!isMounted) return;
          setCategories(cats);
          setState('SELECTION');
        } else if (activeEvent.status === EventStatus.WAITING || now < startTime) {
          setState('WAITING_ROOM');
        } else {
          // Event CLOSED or DRAFT
          setState('WAITING_ROOM');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Gagal memuat event.');
        setState('JOIN');
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [targetEventId]);

  // Countdown timer hook
  const countdown = useCountdown({
    targetDate: event?.selectionStartsAt,
    serverTime: event?.serverTime,
    onFinish: useCallback(async () => {
      // Only transition when user is actively in the WAITING_ROOM and has joined
      if (!event || !participant || state !== 'WAITING_ROOM') return;
      // When countdown hits zero, automatically transition to SELECTION and load categories
      try {
        const cats = await api.getCategories(event.id);
        setCategories(cats);
        setState('SELECTION');
      } catch {
        // Retry shortly
        setTimeout(async () => {
          if (event) {
            const cats = await api.getCategories(event.id);
            setCategories(cats);
            setState('SELECTION');
          }
        }, 1000);
      }
    }, [event, participant, state]),
  });

  // State Resynchronization Protocol (after reconnect or stale recovery)
  const resynchronize = useCallback(async () => {
    if (!event || !participant) return;

    try {
      // 1. Authoritative selection check
      const selData = await api.getParticipantSelection(event.id, participant.id);
      if (selData.hasSelected && selData.selection) {
        setSelection(selData.selection);
        storage.setSelection(selData.selection);
        setState('COMPLETED');
        return;
      }

      // 2. Authoritative categories refresh
      const cats = await api.getCategories(event.id);
      setCategories(cats);
    } catch {
      // Silent catch on network blip
    }
  }, [event, participant]);

  // Handle live quota broadcast
  const handleQuotaUpdate = useCallback((payload: CategoryQuotaUpdatedPayload) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === payload.categoryId
          ? {
              ...c,
              remainingQuota: payload.remainingQuota,
              status: payload.status,
            }
          : c,
      ),
    );
  }, []);

  // Handle live event status broadcast
  const handleEventStatusUpdate = useCallback(
    async (payload: EventStatusUpdatedPayload) => {
      setEvent((prev) => (prev ? { ...prev, status: payload.status } : null));

      if (payload.status === EventStatus.OPEN && state === 'WAITING_ROOM') {
        if (event) {
          const cats = await api.getCategories(event.id);
          setCategories(cats);
        }
        setState('SELECTION');
      }
    },
    [state, event],
  );

  // Realtime Socket hook
  const { status: connectionStatus } = useSocket({
    eventId: event?.id || null,
    onQuotaUpdate: handleQuotaUpdate,
    onEventStatusUpdate: handleEventStatusUpdate,
    onReconnect: resynchronize,
  });

  // Action: Join Event
  const joinEvent = useCallback(
    async (name: string) => {
      if (!event) throw new Error('Event belum dimuat.');
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw new Error('Nama minimal 2 karakter.');
      }
      if (trimmed.length > 100) {
        throw new Error('Nama maksimal 100 karakter.');
      }

      setErrorMessage(null);
      const newParticipant = await api.joinEvent(event.id, trimmed);
      setParticipant(newParticipant);
      storage.setParticipant(newParticipant.id, newParticipant.name);

      const now = new Date(event.serverTime || Date.now());
      const startTime = new Date(event.selectionStartsAt);
      const isOpen = event.status === EventStatus.OPEN && now >= startTime;

      if (isOpen) {
        const cats = await api.getCategories(event.id);
        setCategories(cats);
        setState('SELECTION');
      } else {
        setState('WAITING_ROOM');
      }
    },
    [event],
  );

  // Action: Select Category
  const selectCategory = useCallback(
    async (categoryId: string) => {
      if (!event) return;
      if (!participant) {
        setState('JOIN');
        setErrorMessage('Silakan masukkan nama terlebih dahulu.');
        return;
      }

      setProcessingCategoryId(categoryId);
      setState('PROCESSING');
      setErrorMessage(null);

      try {
        const newSelection = await api.createSelection(event.id, participant.id, categoryId);
        setSelection(newSelection);
        storage.setSelection(newSelection);
        setState('SUCCESS');
      } catch (err: any) {
        const errorMsg =
          err instanceof ApiError && err.code === 'QUOTA_EXHAUSTED'
            ? 'Kategori baru saja habis. Pilih konsumsi lainnya.'
            : err instanceof ApiError && err.code === 'ALREADY_SELECTED'
              ? 'Kamu sudah memiliki pilihan.'
              : err instanceof ApiError && err.code === 'EVENT_NOT_OPEN'
                ? 'Pemilihan belum dibuka atau sudah ditutup.'
                : err.message || 'Gagal memilih konsumsi. Silakan coba lagi.';

        setErrorMessage(errorMsg);

        if (err instanceof ApiError && err.code === 'ALREADY_SELECTED') {
          // Recover existing selection
          try {
            const existing = await api.getParticipantSelection(event.id, participant.id);
            if (existing.selection) {
              setSelection(existing.selection);
              storage.setSelection(existing.selection);
            }
          } catch {
            // ignore
          }
          setState('COMPLETED');
        } else {
          // If quota exhausted or other error, allow immediate retry on another category
          setState('SELECTION_FAILED');
        }
      } finally {
        setProcessingCategoryId(null);
      }
    },
    [event, participant],
  );

  const dismissError = useCallback(() => {
    setErrorMessage(null);
    if (state === 'SELECTION_FAILED') {
      setState('SELECTION');
    }
  }, [state]);

  const resetSession = useCallback(() => {
    storage.clearSession();
    setParticipant(null);
    setSelection(null);
    setState('JOIN');
  }, []);

  return {
    state,
    connectionStatus,
    event,
    participant,
    categories,
    selection,
    processingCategoryId,
    errorMessage,
    countdown,
    joinEvent,
    selectCategory,
    dismissError,
    resetSession,
  };
}
