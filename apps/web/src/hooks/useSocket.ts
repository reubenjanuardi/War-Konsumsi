'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type CategoryQuotaUpdatedPayload,
  type EventStatusUpdatedPayload,
} from '@war-konsumsi/shared';

export type SocketStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

interface UseSocketOptions {
  eventId: string | null;
  onQuotaUpdate?: (payload: CategoryQuotaUpdatedPayload) => void;
  onEventStatusUpdate?: (payload: EventStatusUpdatedPayload) => void;
  onReconnect?: () => void;
}

export function useSocket({
  eventId,
  onQuotaUpdate,
  onEventStatusUpdate,
  onReconnect,
}: UseSocketOptions) {
  const [status, setStatus] = useState<SocketStatus>('DISCONNECTED');
  const socketRef = useRef<Socket | null>(null);
  const wasDisconnectedRef = useRef(false);

  // Keep callback refs fresh
  const onQuotaUpdateRef = useRef(onQuotaUpdate);
  onQuotaUpdateRef.current = onQuotaUpdate;
  const onEventStatusUpdateRef = useRef(onEventStatusUpdate);
  onEventStatusUpdateRef.current = onEventStatusUpdate;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!eventId) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined' && window.location
        ? window.location.port === '3000'
          ? `${window.location.protocol}//${window.location.hostname}:4000`
          : window.location.origin
        : 'http://localhost:4000');
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('CONNECTED');
      // Join event room
      socket.emit(SOCKET_EVENTS.JOIN_EVENT, { eventId });

      // If recovering from a disconnect, trigger resynchronization callback
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        if (onReconnectRef.current) {
          onReconnectRef.current();
        }
      }
    });

    socket.on('disconnect', (reason) => {
      wasDisconnectedRef.current = true;
      setStatus('DISCONNECTED');
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', () => {
      wasDisconnectedRef.current = true;
      setStatus('RECONNECTING');
    });

    socket.on(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, (payload: CategoryQuotaUpdatedPayload) => {
      if (onQuotaUpdateRef.current) {
        onQuotaUpdateRef.current(payload);
      }
    });

    socket.on(SOCKET_EVENTS.EVENT_STATUS_UPDATED, (payload: EventStatusUpdatedPayload) => {
      if (onEventStatusUpdateRef.current) {
        onEventStatusUpdateRef.current(payload);
      }
    });

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_EVENT, { eventId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [eventId]);

  return { status };
}
