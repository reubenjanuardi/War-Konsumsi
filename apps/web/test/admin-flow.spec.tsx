import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminAuthGate } from '../src/components/admin/AdminAuthGate';
import { AdminHeader } from '../src/components/admin/AdminHeader';
import { DashboardOverview } from '../src/components/admin/DashboardOverview';
import { CategoryQuotaManager } from '../src/components/admin/CategoryQuotaManager';
import { ParticipantMonitor } from '../src/components/admin/ParticipantMonitor';
import { EmergencyPanel } from '../src/components/admin/EmergencyPanel';
import { ExportSection } from '../src/components/admin/ExportSection';
import { EventStatus, CategoryStatus, type AdminDashboardDto, type AdminParticipantItemDto } from '@war-konsumsi/shared';
import { adminApi } from '../src/lib/admin-api';

vi.mock('../src/lib/admin-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/admin-api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      verifySecret: vi.fn(),
    },
  };
});

describe('Admin Frontend Components & Flow Tests', () => {
  const mockDashboardData: AdminDashboardDto = {
    event: {
      id: 'event-uuid-1',
      name: 'War Gathering 2026',
      status: EventStatus.OPEN,
      selectionStartsAt: '2026-09-15T10:00:00.000Z',
      selectionEndsAt: '2026-09-15T12:00:00.000Z',
      createdAt: '2026-09-15T09:00:00.000Z',
      updatedAt: '2026-09-15T09:00:00.000Z',
      serverTime: '2026-09-15T10:30:00.000Z',
    },
    totalParticipants: 100,
    selectedParticipants: 75,
    unselectedParticipants: 25,
    totalQuota: 120,
    totalRemainingQuota: 45,
    soldOutCategoriesCount: 1,
    categories: [
      {
        id: 'cat-1',
        eventId: 'event-uuid-1',
        name: 'Ayam Bakar Madu',
        description: 'Ayam bakar dengan lalapan segar',
        quota: 50,
        remainingQuota: 10,
        status: CategoryStatus.LIMITED,
        isActive: true,
        createdAt: '2026-09-15T09:00:00.000Z',
        updatedAt: '2026-09-15T09:00:00.000Z',
      },
      {
        id: 'cat-2',
        eventId: 'event-uuid-1',
        name: 'Rendang Sapi Spesial',
        description: 'Rendang daging sapi empuk',
        quota: 40,
        remainingQuota: 0,
        status: CategoryStatus.SOLD_OUT,
        isActive: true,
        createdAt: '2026-09-15T09:00:00.000Z',
        updatedAt: '2026-09-15T09:00:00.000Z',
      },
    ],
  };

  const mockParticipants: AdminParticipantItemDto[] = [
    {
      id: 'p-1',
      eventId: 'event-uuid-1',
      name: 'Budi Santoso',
      createdAt: '2026-09-15T09:15:00.000Z',
      selection: {
        id: 'sel-1',
        categoryId: 'cat-1',
        categoryName: 'Ayam Bakar Madu',
        selectedAt: '2026-09-15T10:01:05.000Z',
      },
    },
    {
      id: 'p-2',
      eventId: 'event-uuid-1',
      name: 'Siti Rahma',
      createdAt: '2026-09-15T09:20:00.000Z',
      selection: null,
    },
  ];

  // =========================================================================
  // 1. Admin Auth Gate
  // =========================================================================
  describe('AdminAuthGate', () => {
    it('requires secret input and rejects invalid authentication', async () => {
      vi.mocked(adminApi.verifySecret).mockResolvedValue(false);
      const onAuth = vi.fn();

      render(<AdminAuthGate onAuthenticated={onAuth} />);

      const submitBtn = screen.getByRole('button', { name: /Buka Dashboard Admin/i });
      expect(submitBtn).toBeDisabled();

      const input = screen.getByPlaceholderText(/Masukkan secret key/i);
      fireEvent.change(input, { target: { value: 'wrong-key' } });
      expect(submitBtn).not.toBeDisabled();

      await React.act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(adminApi.verifySecret).toHaveBeenCalledWith('wrong-key');
      expect(onAuth).not.toHaveBeenCalled();
      expect(screen.getByText(/Kunci rahasia admin tidak valid/i)).toBeInTheDocument();
    });

    it('successfully calls onAuthenticated when secret is valid', async () => {
      vi.mocked(adminApi.verifySecret).mockResolvedValue(true);
      const onAuth = vi.fn();

      render(<AdminAuthGate onAuthenticated={onAuth} />);

      const input = screen.getByPlaceholderText(/Masukkan secret key/i);
      const submitBtn = screen.getByRole('button', { name: /Buka Dashboard Admin/i });

      fireEvent.change(input, { target: { value: 'dev-admin-secret' } });

      await React.act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(adminApi.verifySecret).toHaveBeenCalledWith('dev-admin-secret');
      expect(onAuth).toHaveBeenCalledWith('dev-admin-secret');
    });
  });

  // =========================================================================
  // 2. Admin Header
  // =========================================================================
  describe('AdminHeader', () => {
    it('renders event details, OPEN status badge, and realtime status', () => {
      const onLogout = vi.fn();
      render(
        <AdminHeader
          event={mockDashboardData.event}
          eventsList={[mockDashboardData.event]}
          selectedEventId="event-uuid-1"
          onSelectEvent={vi.fn()}
          socketConnected={true}
          onLogout={onLogout}
        />,
      );

      expect(screen.getByText('War Gathering 2026')).toBeInTheDocument();
      expect(screen.getByText(/OPEN \/\/ SELEKSI BUKA/i)).toBeInTheDocument();
      expect(screen.getByText('REALTIME LIVE')).toBeInTheDocument();

      const logoutBtn = screen.getByRole('button', { name: /KELUAR/i });
      fireEvent.click(logoutBtn);
      expect(onLogout).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Dashboard Overview (KPI Cards)
  // =========================================================================
  describe('DashboardOverview', () => {
    it('renders high-density KPI metrics and quota progress accurately', () => {
      render(<DashboardOverview data={mockDashboardData} />);

      expect(screen.getByText('100')).toBeInTheDocument(); // total participants
      expect(screen.getAllByText('75').length).toBeGreaterThanOrEqual(1); // selected participants
      expect(screen.getByText('25')).toBeInTheDocument(); // unselected participants
      expect(screen.getAllByText('120').length).toBeGreaterThanOrEqual(1); // total quota
      expect(screen.getByText('45')).toBeInTheDocument(); // total remaining quota
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // sold out count

      // Verify category items
      expect(screen.getByText('Ayam Bakar Madu')).toBeInTheDocument();
      expect(screen.getByText('Rendang Sapi Spesial')).toBeInTheDocument();
      expect(screen.getByText('HABIS')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Category Quota Manager
  // =========================================================================
  describe('CategoryQuotaManager', () => {
    it('allows toggling active status and adjusting quota', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const onReset = vi.fn().mockResolvedValue(undefined);
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <CategoryQuotaManager
          categories={mockDashboardData.categories}
          onCreateCategory={onCreate}
          onUpdateCategory={onUpdate}
          onResetQuota={onReset}
          onDeleteCategory={onDelete}
        />,
      );

      // Click +1 on first category
      const plusOneButtons = screen.getAllByRole('button', { name: /\+1/i });
      await React.act(async () => {
        fireEvent.click(plusOneButtons[0]);
      });
      expect(onUpdate).toHaveBeenCalledWith('cat-1', { quota: 51 });

      // Click active toggle
      const activeButtons = screen.getAllByRole('button', { name: /^AKTIF$/i });
      await React.act(async () => {
        fireEvent.click(activeButtons[0]);
      });
      expect(onUpdate).toHaveBeenCalledWith('cat-1', { isActive: false });
    });

    it('opens reset quota modal and calls onResetQuota upon confirmation', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const onReset = vi.fn().mockResolvedValue(undefined);
      const onCreate = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <CategoryQuotaManager
          categories={mockDashboardData.categories}
          onCreateCategory={onCreate}
          onUpdateCategory={onUpdate}
          onResetQuota={onReset}
          onDeleteCategory={onDelete}
        />,
      );

      const resetButtons = screen.getAllByRole('button', { name: /Reset Kuota/i });
      fireEvent.click(resetButtons[0]);

      expect(screen.getByText(/Reset Kuota Menu: Ayam Bakar Madu/i)).toBeInTheDocument();

      const applyBtn = screen.getByRole('button', { name: /Terapkan Kuota Baru/i });
      await React.act(async () => {
        fireEvent.click(applyBtn);
      });

      expect(onReset).toHaveBeenCalledWith('cat-1', 50);
    });

    it('opens delete modal and calls onDeleteCategory upon confirmation', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <CategoryQuotaManager
          categories={mockDashboardData.categories}
          onCreateCategory={vi.fn()}
          onUpdateCategory={vi.fn()}
          onResetQuota={vi.fn()}
          onDeleteCategory={onDelete}
        />,
      );

      const deleteButtons = screen.getAllByRole('button', { name: /Hapus/i });
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText(/Konfirmasi Hapus Menu Konsumsi/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /Ya, Hapus Menu/i });
      await React.act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(onDelete).toHaveBeenCalledWith('cat-1');
    });
  });

  // =========================================================================
  // 5. Participant Monitor
  // =========================================================================
  describe('ParticipantMonitor', () => {
    it('filters participants by search input', () => {
      render(
        <ParticipantMonitor
          participants={mockParticipants}
          onCancelSelection={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );

      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
      expect(screen.getByText('Siti Rahma')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Cari nama peserta/i);
      fireEvent.change(searchInput, { target: { value: 'Budi' } });

      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
      expect(screen.queryByText('Siti Rahma')).not.toBeInTheDocument();
    });

    it('filters by status tabs and opens cancel selection modal', async () => {
      const onCancel = vi.fn().mockResolvedValue(undefined);

      render(
        <ParticipantMonitor
          participants={mockParticipants}
          onCancelSelection={onCancel}
          onRefresh={vi.fn()}
        />,
      );

      // Filter Sudah Memilih
      const sudahMemilihTab = screen.getByRole('button', { name: /Sudah Memilih/i });
      fireEvent.click(sudahMemilihTab);

      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
      expect(screen.queryByText('Siti Rahma')).not.toBeInTheDocument();

      // Open cancel selection modal
      const cancelBtn = screen.getByRole('button', { name: /Batalkan/i });
      fireEvent.click(cancelBtn);

      expect(screen.getByText(/Konfirmasi Pembatalan Pilihan/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /Ya, Batalkan Pilihan/i });
      await React.act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(onCancel).toHaveBeenCalledWith('sel-1');
    });
  });

  // =========================================================================
  // 6. Emergency Panel & Export Section
  // =========================================================================
  describe('EmergencyPanel & ExportSection', () => {
    it('executes force close from confirmation modal in EmergencyPanel', async () => {
      const onForceClose = vi.fn().mockResolvedValue(undefined);
      const onResetQuota = vi.fn().mockResolvedValue(undefined);

      render(
        <EmergencyPanel
          categories={mockDashboardData.categories}
          onForceCloseEvent={onForceClose}
          onResetQuota={onResetQuota}
        />,
      );

      const triggerBtn = screen.getByRole('button', { name: /Hentikan Event Sekarang/i });
      fireEvent.click(triggerBtn);

      expect(screen.getByText(/Konfirmasi Tindakan Darurat/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /Eksekusi Force Close/i });
      await React.act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(onForceClose).toHaveBeenCalled();
    });

    it('triggers CSV download in ExportSection', async () => {
      const onExport = vi.fn().mockResolvedValue(undefined);

      render(<ExportSection data={mockDashboardData} onExportCsv={onExport} />);

      const downloadBtn = screen.getByRole('button', { name: /Unduh Rekap Konsumsi \(\.CSV\)/i });
      await React.act(async () => {
        fireEvent.click(downloadBtn);
      });

      expect(onExport).toHaveBeenCalled();
    });
  });
});
