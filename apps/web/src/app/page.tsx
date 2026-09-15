'use client';

import React from 'react';
import { useSelectionWar } from '../hooks/useSelectionWar';
import { Header } from '../components/Header';
import { StatusBanner } from '../components/StatusBanner';
import { JoinScreen } from '../components/JoinScreen';
import { WaitingRoom } from '../components/WaitingRoom';
import { SelectionScreen } from '../components/SelectionScreen';
import { ConfirmationTicket } from '../components/ConfirmationTicket';
import { Loader2 } from 'lucide-react';

export default function ParticipantPage() {
  const {
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
  } = useSelectionWar();

  return (
    <div className="flex-1 flex flex-col justify-between w-full max-w-md mx-auto">
      {/* Top Header & Connection Status */}
      <Header
        eventName={event?.name}
        participantName={participant?.name}
        connectionStatus={connectionStatus}
        onResetSession={state === 'JOIN' || state === 'WAITING_ROOM' ? resetSession : undefined}
      />

      {/* Realtime Connection Loss & Error Banners */}
      <StatusBanner
        connectionStatus={connectionStatus}
        errorMessage={errorMessage}
        onDismissError={dismissError}
      />

      {/* Main Flow Controller */}
      <main className="flex-1 flex flex-col">
        {state === 'LOADING' && (
          <div
            data-testid="loading-state"
            className="flex-1 flex flex-col items-center justify-center py-16 text-center"
          >
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
            <span className="text-xs text-slate-400 font-mono tracking-wide">
              Menghubungkan ke sistem...
            </span>
          </div>
        )}

        {state === 'JOIN' && (
          <JoinScreen eventName={event?.name} onJoin={joinEvent} />
        )}

        {state === 'WAITING_ROOM' && (
          <WaitingRoom
            participantName={participant?.name}
            eventName={event?.name}
            countdown={countdown}
            startsAt={event?.selectionStartsAt}
          />
        )}

        {(state === 'SELECTION' || state === 'PROCESSING' || state === 'SELECTION_FAILED') && (
          <SelectionScreen
            categories={categories}
            processingCategoryId={processingCategoryId}
            onSelect={selectCategory}
          />
        )}

        {(state === 'SUCCESS' || state === 'COMPLETED') && (
          <ConfirmationTicket
            participantName={participant?.name}
            eventName={event?.name}
            selection={selection}
          />
        )}
      </main>

      {/* Clean Mobile Footer */}
      <footer className="pt-6 pb-2 border-t border-slate-800/40 text-center">
        <span className="text-[10px] text-slate-500 font-mono">
          War Konsumsi &copy; {new Date().getFullYear()} &bull; Quota Realtime
        </span>
      </footer>
    </div>
  );
}
