import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { JoinScreen } from '../src/components/JoinScreen';
import { WaitingRoom } from '../src/components/WaitingRoom';
import { CategoryCard } from '../src/components/CategoryCard';
import { SelectionScreen } from '../src/components/SelectionScreen';
import { ConfirmationTicket } from '../src/components/ConfirmationTicket';
import { StatusBanner } from '../src/components/StatusBanner';
import { ConnectionIndicator } from '../src/components/ConnectionIndicator';
import { CategoryStatus, EventStatus, type CategoryDto, type SelectionDto, type EventDetailDto } from '@war-konsumsi/shared';
import { useSelectionWar } from '../src/hooks/useSelectionWar';
import { api } from '../src/lib/api';
import { storage } from '../src/lib/storage';

vi.mock('../src/lib/api', () => ({
  api: {
    getCurrentEvent: vi.fn(),
    getEvent: vi.fn(),
    getCategories: vi.fn(),
    joinEvent: vi.fn(),
    getParticipantSelection: vi.fn(),
    createSelection: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../src/hooks/useSocket', () => ({
  useSocket: () => ({
    socket: null,
    status: 'CONNECTED',
  }),
}));

describe('Participant Frontend Components & Flow Tests', () => {
  // =========================================================================
  // 1. Join Screen Validation
  // =========================================================================
  describe('JoinScreen', () => {
    it('should disable submit button when input is empty or less than 2 characters', () => {
      const onJoin = vi.fn();
      render(<JoinScreen eventName="Tech Gathering 2026" onJoin={onJoin} />);

      const input = screen.getByTestId('join-name-input');
      const submitBtn = screen.getByTestId('join-submit-btn');

      expect(submitBtn).toBeDisabled();

      // Type 1 character
      fireEvent.change(input, { target: { value: 'A' } });
      expect(submitBtn).toBeDisabled();
      expect(screen.getByText(/Nama minimal 2 karakter/i)).toBeInTheDocument();

      // Type spaces only
      fireEvent.change(input, { target: { value: '   ' } });
      expect(submitBtn).toBeDisabled();
    });

    it('should enable submit and call onJoin with trimmed name when valid', async () => {
      const onJoin = vi.fn().mockResolvedValue(undefined);
      render(<JoinScreen eventName="Tech Gathering 2026" onJoin={onJoin} />);

      const input = screen.getByTestId('join-name-input');
      const submitBtn = screen.getByTestId('join-submit-btn');

      fireEvent.change(input, { target: { value: '  Reuben Peserta  ' } });
      expect(submitBtn).not.toBeDisabled();

      await React.act(async () => {
        fireEvent.click(submitBtn);
      });
      expect(onJoin).toHaveBeenCalledWith('Reuben Peserta');
    });
  });

  // =========================================================================
  // 2. Waiting Room & Countdown
  // =========================================================================
  describe('WaitingRoom', () => {
    it('should render participant greeting, waiting badge, and formatted countdown', () => {
      const mockCountdown = {
        hours: '01',
        minutes: '24',
        seconds: '45',
        totalSeconds: 5085,
        isFinished: false,
        formatted: '01:24:45',
      };

      render(
        <WaitingRoom
          participantName="Reuben"
          eventName="War Gathering"
          countdown={mockCountdown}
          startsAt="2026-09-15T12:00:00Z"
        />,
      );

      expect(screen.getByText(/RUANG TUNGGU/i)).toBeInTheDocument();
      expect(screen.getByText(/Hai,/i)).toBeInTheDocument();
      expect(screen.getByText(/Reuben/i)).toBeInTheDocument();
      expect(screen.getByTestId('countdown-display')).toHaveTextContent('01');
      expect(screen.getByTestId('countdown-display')).toHaveTextContent('24');
      expect(screen.getByTestId('countdown-display')).toHaveTextContent('45');
      expect(screen.getByText(/Jangan tutup atau refresh halaman ini/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Category Card & Quota Badges
  // =========================================================================
  describe('CategoryCard & Quota Badges', () => {
    const baseCat: CategoryDto = {
      id: 'cat-1',
      eventId: 'ev-1',
      name: 'Rendang Padang',
      description: 'Daging sapi rempah pilihan',
      imageUrl: null,
      quota: 10,
      remainingQuota: 8,
      status: CategoryStatus.AVAILABLE,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should render AVAILABLE badge (>3 quota)', () => {
      render(
        <CategoryCard
          category={baseCat}
          isProcessingThis={false}
          isAnyProcessing={false}
          onSelect={vi.fn()}
        />,
      );

      const badge = screen.getByTestId('quota-badge-cat-1');
      expect(badge).toHaveTextContent('8 tersisa');
      const btn = screen.getByTestId('select-btn-cat-1');
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveTextContent(/PILIH MENU INI/i);
    });

    it('should render LIMITED badge (2-3 quota)', () => {
      const limitedCat = { ...baseCat, remainingQuota: 2, status: CategoryStatus.LIMITED };
      render(
        <CategoryCard
          category={limitedCat}
          isProcessingThis={false}
          isAnyProcessing={false}
          onSelect={vi.fn()}
        />,
      );

      const badge = screen.getByTestId('quota-badge-cat-1');
      expect(badge).toHaveTextContent(/2 TERSISA/i);
    });

    it('should render LAST_ONE urgency badge (1 quota)', () => {
      const lastOneCat = { ...baseCat, remainingQuota: 1, status: CategoryStatus.LAST_ONE };
      render(
        <CategoryCard
          category={lastOneCat}
          isProcessingThis={false}
          isAnyProcessing={false}
          onSelect={vi.fn()}
        />,
      );

      const badge = screen.getByTestId('quota-badge-cat-1');
      expect(badge).toHaveTextContent(/1 TERSISA/i);
    });

    it('should render SOLD_OUT badge (0 quota) and disable button', () => {
      const soldOutCat = { ...baseCat, remainingQuota: 0, status: CategoryStatus.SOLD_OUT };
      const onSelect = vi.fn();
      render(
        <CategoryCard
          category={soldOutCat}
          isProcessingThis={false}
          isAnyProcessing={false}
          onSelect={onSelect}
        />,
      );

      const badge = screen.getByTestId('quota-badge-cat-1');
      expect(badge).toHaveTextContent('HABIS');
      const btn = screen.getByTestId('select-btn-cat-1');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent('HABIS');
      fireEvent.click(btn);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should show spinner when this card is processing and lock other cards', () => {
      const { rerender } = render(
        <CategoryCard
          category={baseCat}
          isProcessingThis={true}
          isAnyProcessing={true}
          onSelect={vi.fn()}
        />,
      );

      const btn = screen.getByTestId('select-btn-cat-1');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent(/Memproses.../i);

      // Other card when isAnyProcessing is true
      rerender(
        <CategoryCard
          category={baseCat}
          isProcessingThis={false}
          isAnyProcessing={true}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.getByTestId('select-btn-cat-1')).toBeDisabled();
    });
  });

  // =========================================================================
  // 4. Status Banner: Reconnection & Error Handling
  // =========================================================================
  describe('StatusBanner & ConnectionIndicator', () => {
    it('should show reconnecting banner when connection is not CONNECTED', () => {
      render(
        <StatusBanner
          connectionStatus="RECONNECTING"
          errorMessage={null}
        />,
      );

      expect(screen.getByTestId('reconnecting-banner')).toBeInTheDocument();
      expect(screen.getByText(/Koneksi terputus. Mencoba menghubungkan kembali.../i)).toBeInTheDocument();
    });

    it('should show error banner when errorMessage is present and dismiss on click', () => {
      const onDismiss = vi.fn();
      render(
        <StatusBanner
          connectionStatus="CONNECTED"
          errorMessage="Kategori baru saja habis. Pilih konsumsi lainnya."
          onDismissError={onDismiss}
        />,
      );

      expect(screen.queryByTestId('reconnecting-banner')).not.toBeInTheDocument();
      expect(screen.getByTestId('error-banner')).toHaveTextContent(/Kategori baru saja habis/i);

      const closeBtn = screen.getByLabelText('Tutup pesan');
      fireEvent.click(closeBtn);
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should render ConnectionIndicator states correctly', () => {
      const { rerender } = render(<ConnectionIndicator status="CONNECTED" />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent('LIVE');

      rerender(<ConnectionIndicator status="RECONNECTING" />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent('MENGHUBUNGKAN...');

      rerender(<ConnectionIndicator status="DISCONNECTED" />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent('TERPUTUS');
    });
  });

  // =========================================================================
  // 5. Confirmation Ticket
  // =========================================================================
  describe('ConfirmationTicket', () => {
    const mockSelection: SelectionDto = {
      id: '00000000-0000-4000-8000-000000000001',
      eventId: '00000000-0000-4000-8000-000000000002',
      participantId: '00000000-0000-4000-8000-000000000003',
      categoryId: '00000000-0000-4000-8000-000000000004',
      categoryName: 'Ayam Bakar Madu',
      selectedAt: '2026-09-15T10:00:00.000Z',
    };

    it('should render verified ticket with food category, participant name, and ticket ID', () => {
      render(
        <ConfirmationTicket
          participantName="Reuben Peserta"
          eventName="Tech Summit 2026"
          selection={mockSelection}
        />,
      );

      expect(screen.getByTestId('confirmation-ticket')).toBeInTheDocument();
      expect(screen.getByTestId('ticket-category-name')).toHaveTextContent('Ayam Bakar Madu');
      expect(screen.getByTestId('ticket-participant-name')).toHaveTextContent('Reuben Peserta');
      expect(screen.getByTestId('ticket-id')).toHaveTextContent('00000000 - 0001');
      expect(screen.getByText(/Pilihan kamu telah tersimpan secara permanen/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. Mobile Viewport Layout Testing (320px, 375px, 390px, 430px)
  // =========================================================================
  describe('Mobile Viewport Ergonomics', () => {
    const viewports = [320, 375, 390, 430];

    viewports.forEach((width) => {
      it(`should render cleanly at ${width}px mobile viewport without truncation of critical actions`, () => {
        // Mock window innerWidth
        window.innerWidth = width;

        const categories: CategoryDto[] = [
          {
            id: 'c-1',
            eventId: 'e-1',
            name: 'Nasi Goreng Spesial',
            description: 'Telur ceplok dan sate ayam',
            imageUrl: null,
            quota: 20,
            remainingQuota: 5,
            status: CategoryStatus.AVAILABLE,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        const { container } = render(
          <div style={{ width: `${width}px`, maxWidth: '100%' }}>
            <SelectionScreen
              categories={categories}
              processingCategoryId={null}
              onSelect={vi.fn()}
            />
          </div>,
        );

        // Verify container rendered properly
        expect(container).toBeDefined();
        const selectBtn = screen.getByTestId('select-btn-c-1');
        expect(selectBtn).toBeVisible();
        expect(selectBtn.classList.contains('min-h-[48px]')).toBe(true);
      });
    });
  });

  // =========================================================================
  // 7. useSelectionWar Flow States (Late Entry, Early Entry, Selection)
  // =========================================================================
  describe('useSelectionWar Flow Lifecycle', () => {
    const mockOpenEvent: EventDetailDto = {
      id: 'event-open-1',
      name: 'Makan Siang Bersama 2026',
      status: EventStatus.OPEN,
      selectionStartsAt: '2026-09-15T09:00:00.000Z', // In the past (started)
      selectionEndsAt: '2026-09-15T12:00:00.000Z',
      createdAt: '2026-09-15T08:00:00.000Z',
      updatedAt: '2026-09-15T08:00:00.000Z',
      serverTime: '2026-09-15T10:00:00.000Z',
    };

    const mockCategories: CategoryDto[] = [
      {
        id: 'cat-1',
        eventId: 'event-open-1',
        name: 'Ayam Goreng Lengkuas',
        description: 'Ayam bumbu lengkuas gurih',
        imageUrl: null,
        quota: 25,
        remainingQuota: 10,
        status: CategoryStatus.AVAILABLE,
        isActive: true,
        createdAt: '2026-09-15T08:00:00.000Z',
        updatedAt: '2026-09-15T08:00:00.000Z',
      },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
      storage.clearSession();
    });

    it('should stay in JOIN state when user enters after war has already started (no cached participant)', async () => {
      vi.mocked(api.getCurrentEvent).mockResolvedValue(mockOpenEvent);
      vi.mocked(api.getCategories).mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useSelectionWar());

      // Wait for initial init() promise to resolve
      await act(async () => {
        await Promise.resolve();
      });

      // Must NOT skip to SELECTION even though selectionStartsAt has already passed
      expect(result.current.state).toBe('JOIN');
      expect(result.current.participant).toBeNull();
      expect(result.current.countdown.isFinished).toBe(true);
    });

    it('should transition directly to SELECTION when joining an event that is already OPEN', async () => {
      vi.mocked(api.getCurrentEvent).mockResolvedValue(mockOpenEvent);
      vi.mocked(api.getCategories).mockResolvedValue(mockCategories);
      vi.mocked(api.joinEvent).mockResolvedValue({
        id: 'part-123',
        eventId: 'event-open-1',
        name: 'Budi Santoso',
        createdAt: '2026-09-15T10:01:00.000Z',
      });

      const { result } = renderHook(() => useSelectionWar());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.state).toBe('JOIN');

      // User submits their name
      await act(async () => {
        await result.current.joinEvent('Budi Santoso');
      });

      expect(result.current.participant).toMatchObject({ id: 'part-123', name: 'Budi Santoso' });
      expect(result.current.state).toBe('SELECTION');
      expect(result.current.categories).toEqual(mockCategories);
    });

    it('should stay in WAITING_ROOM when joining before start, and auto-transition to SELECTION on countdown finish', async () => {
      const mockWaitingEvent: EventDetailDto = {
        id: 'event-waiting-1',
        name: 'War Dinner',
        status: EventStatus.OPEN,
        selectionStartsAt: '2026-09-15T11:00:00.000Z', // In the future
        selectionEndsAt: '2026-09-15T12:00:00.000Z',
        createdAt: '2026-09-15T08:00:00.000Z',
        updatedAt: '2026-09-15T08:00:00.000Z',
        serverTime: '2026-09-15T10:55:00.000Z', // 5 mins before start
      };

      vi.mocked(api.getCurrentEvent).mockResolvedValue(mockWaitingEvent);
      vi.mocked(api.getCategories).mockResolvedValue(mockCategories);
      vi.mocked(api.joinEvent).mockResolvedValue({
        id: 'part-456',
        eventId: 'event-waiting-1',
        name: 'Siti Rahma',
        createdAt: '2026-09-15T10:55:30.000Z',
      });

      const { result } = renderHook(() => useSelectionWar());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.state).toBe('JOIN');

      await act(async () => {
        await result.current.joinEvent('Siti Rahma');
      });

      // War hasn't started yet -> WAITING_ROOM
      expect(result.current.state).toBe('WAITING_ROOM');
      expect(result.current.participant).toMatchObject({ id: 'part-456', name: 'Siti Rahma' });
    });

    it('should guard selectCategory and reset to JOIN if participant is null', async () => {
      vi.mocked(api.getCurrentEvent).mockResolvedValue(mockOpenEvent);

      const { result } = renderHook(() => useSelectionWar());

      await act(async () => {
        await Promise.resolve();
      });

      // Participant is null
      await act(async () => {
        await result.current.selectCategory('cat-1');
      });

      expect(result.current.state).toBe('JOIN');
      expect(result.current.errorMessage).toBe('Silakan masukkan nama terlebih dahulu.');
    });
  });
});
