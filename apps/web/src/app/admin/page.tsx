'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, adminStorage } from '../../lib/admin-api';
import { useSocket } from '../../hooks/useSocket';
import { AdminAuthGate } from '../../components/admin/AdminAuthGate';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { DashboardOverview } from '../../components/admin/DashboardOverview';
import { EventControls } from '../../components/admin/EventControls';
import { CategoryQuotaManager } from '../../components/admin/CategoryQuotaManager';
import { ParticipantMonitor } from '../../components/admin/ParticipantMonitor';
import { EmergencyPanel } from '../../components/admin/EmergencyPanel';
import { ExportSection } from '../../components/admin/ExportSection';
import type {
  AdminDashboardDto,
  AdminParticipantItemDto,
  EventDetailDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQuotaUpdatedPayload,
  EventStatusUpdatedPayload,
} from '@war-konsumsi/shared';

type AdminTab = 'overview' | 'event' | 'categories' | 'participants' | 'emergency' | 'export';

export default function AdminPage() {
  const [secret, setSecret] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [eventsList, setEventsList] = useState<EventDetailDto[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<AdminDashboardDto | null>(null);
  const [participants, setParticipants] = useState<AdminParticipantItemDto[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Check server session on initial mount via HttpOnly cookie
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const isAuth = await adminApi.checkSession();
        if (isAuth && mounted) {
          setSecret('cookie-session');
        }
      } catch {
        // Not authenticated
      } finally {
        if (mounted) setIsReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch full data for the selected event
  const refreshData = useCallback(
    async (eventId: string, adminSecret: string) => {
      if (!eventId || !adminSecret) return;
      try {
        const [dash, parts] = await Promise.all([
          adminApi.getDashboard(adminSecret, eventId),
          adminApi.getParticipants(adminSecret, eventId),
        ]);
        setDashboardData(dash);
        setParticipants(parts);
      } catch (err: any) {
        if (err.status === 401) {
          adminStorage.clearSecret();
          setSecret('');
          showFeedback('Sesi admin berakhir atau kunci rahasia tidak sah.', 'error');
        } else {
          showFeedback(err.message || 'Gagal memuat data event.', 'error');
        }
      }
    },
    [],
  );

  // Load events list after secret is set
  useEffect(() => {
    if (!secret) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const evs = await adminApi.getEvents(secret);
        if (mounted) {
          setEventsList(evs);
          if (evs.length > 0) {
            const initialId = evs[0].id;
            setSelectedEventId(initialId);
            await refreshData(initialId, secret);
          }
        }
      } catch {
        if (mounted) {
          adminStorage.clearSecret();
          setSecret('');
          showFeedback('Kredensial admin ditolak oleh server.', 'error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [secret, refreshData]);

  // Handle live quota updates from Socket.IO
  const handleQuotaUpdate = useCallback((payload: CategoryQuotaUpdatedPayload) => {
    setDashboardData((prev) => {
      if (!prev) return prev;
      const updatedCategories = prev.categories.map((cat) => {
        if (cat.id === payload.categoryId) {
          return {
            ...cat,
            remainingQuota: payload.remainingQuota,
            status: payload.status,
          };
        }
        return cat;
      });

      const totalRemaining = updatedCategories.reduce((sum, c) => sum + c.remainingQuota, 0);
      const soldOutCount = updatedCategories.filter((c) => c.remainingQuota <= 0).length;
      const totalSelected = prev.totalQuota - totalRemaining;

      return {
        ...prev,
        categories: updatedCategories,
        totalRemainingQuota: totalRemaining,
        soldOutCategoriesCount: soldOutCount,
        selectedParticipants: Math.max(prev.selectedParticipants, totalSelected),
        unselectedParticipants: Math.max(0, prev.totalParticipants - totalSelected),
      };
    });
  }, []);

  // Handle live event status updates from Socket.IO
  const handleEventStatusUpdate = useCallback((payload: EventStatusUpdatedPayload) => {
    setDashboardData((prev) => {
      if (!prev || prev.event.id !== payload.eventId) return prev;
      return {
        ...prev,
        event: {
          ...prev.event,
          status: payload.status,
        },
      };
    });
  }, []);

  // Re-sync with PostgreSQL when socket reconnects
  const handleResync = useCallback(() => {
    if (selectedEventId && secret) {
      refreshData(selectedEventId, secret);
    }
  }, [selectedEventId, secret, refreshData]);

  // Connect Socket.IO
  const { status: socketStatus } = useSocket({
    eventId: selectedEventId || null,
    onQuotaUpdate: handleQuotaUpdate,
    onEventStatusUpdate: handleEventStatusUpdate,
    onReconnect: handleResync,
  });

  // Action handlers
  const handleOpenEvent = async () => {
    if (!selectedEventId || !secret) return;
    try {
      const updated = await adminApi.openEvent(secret, selectedEventId);
      setDashboardData((prev) => (prev ? { ...prev, event: updated } : prev));
      showFeedback('Event berhasil dibuka. Peserta dapat mulai memilih.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal membuka event.', 'error');
    }
  };

  const handleCloseEvent = async () => {
    if (!selectedEventId || !secret) return;
    try {
      const updated = await adminApi.closeEvent(secret, selectedEventId);
      setDashboardData((prev) => (prev ? { ...prev, event: updated } : prev));
      showFeedback('Event berhasil ditutup.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal menutup event.', 'error');
    }
  };

  const handleForceCloseEvent = async () => {
    if (!selectedEventId || !secret) return;
    try {
      const updated = await adminApi.forceCloseEvent(secret, selectedEventId);
      setDashboardData((prev) => (prev ? { ...prev, event: updated } : prev));
      showFeedback('Event berhasil ditutup secara paksa (force close).');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal melakukan force close.', 'error');
    }
  };

  const handleUpdateEvent = async (data: {
    name?: string;
    selectionStartsAt?: string;
    selectionEndsAt?: string | null;
  }) => {
    if (!selectedEventId || !secret) return;
    try {
      const updated = await adminApi.updateEvent(secret, selectedEventId, data);
      setDashboardData((prev) => (prev ? { ...prev, event: updated } : prev));
      showFeedback('Pengaturan event berhasil diperbarui.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal memperbarui event.', 'error');
    }
  };

  const handleCreateCategory = async (data: CreateCategoryDto) => {
    if (!selectedEventId || !secret) return;
    try {
      await adminApi.createCategory(secret, selectedEventId, data);
      await refreshData(selectedEventId, secret);
      showFeedback(`Menu "${data.name}" berhasil ditambahkan.`);
    } catch (err: any) {
      showFeedback(err.message || 'Gagal menambahkan kategori.', 'error');
    }
  };

  const handleUpdateCategory = async (categoryId: string, data: UpdateCategoryDto) => {
    if (!selectedEventId || !secret) return;
    try {
      await adminApi.updateCategory(secret, selectedEventId, categoryId, data);
      await refreshData(selectedEventId, secret);
      showFeedback('Perubahan menu berhasil disimpan.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal memperbarui kategori.', 'error');
    }
  };

  const handleResetQuota = async (categoryId: string, remainingQuota?: number) => {
    if (!selectedEventId || !secret) return;
    try {
      await adminApi.resetCategoryQuota(secret, selectedEventId, categoryId, remainingQuota);
      await refreshData(selectedEventId, secret);
      showFeedback('Kuota menu berhasil diatur ulang.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal mengatur ulang kuota.', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!selectedEventId || !secret) return;
    try {
      const res = await adminApi.deleteCategory(secret, selectedEventId, categoryId);
      await refreshData(selectedEventId, secret);
      showFeedback(res.message || 'Menu berhasil dihapus.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal menghapus menu.', 'error');
    }
  };

  const handleCancelSelection = async (selectionId: string) => {
    if (!selectedEventId || !secret) return;
    try {
      const res = await adminApi.cancelSelection(secret, selectedEventId, selectionId);
      await refreshData(selectedEventId, secret);
      showFeedback(res.message || 'Pilihan berhasil dibatalkan dan kuota dikembalikan.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal membatalkan pilihan.', 'error');
    }
  };

  const handleExportCsv = async () => {
    if (!selectedEventId || !secret) return;
    await adminApi.downloadExportCsv(secret, selectedEventId);
    showFeedback('File CSV rekap konsumsi berhasil diunduh.');
  };

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // Ignore
    }
    setSecret('');
    setDashboardData(null);
    setParticipants([]);
    setEventsList([]);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
        MEMUAT...
      </div>
    );
  }

  if (!secret) {
    return <AdminAuthGate onAuthenticated={(validSecret) => setSecret(validSecret)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header */}
      <AdminHeader
        event={dashboardData?.event || null}
        eventsList={eventsList}
        selectedEventId={selectedEventId}
        onSelectEvent={(id) => {
          setSelectedEventId(id);
          refreshData(id, secret);
        }}
        socketConnected={socketStatus === 'CONNECTED'}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`mb-5 px-4 py-3 rounded text-xs font-mono border ${
              feedbackMessage.type === 'error'
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            }`}
          >
            {feedbackMessage.text}
          </div>
        )}

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 border-b border-slate-800 pb-3 mb-6 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded transition-colors cursor-pointer uppercase ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Ringkasan Live
          </button>
          <button
            onClick={() => setActiveTab('event')}
            className={`px-3.5 py-2 rounded transition-colors cursor-pointer uppercase ${
              activeTab === 'event'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Kontrol Event
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-2 rounded transition-colors cursor-pointer uppercase ${
              activeTab === 'categories'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Kategori & Kuota ({dashboardData?.categories.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`px-3.5 py-2 rounded transition-colors cursor-pointer uppercase ${
              activeTab === 'participants'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Monitoring Peserta ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab('emergency')}
            className={`px-3.5 py-2 rounded transition-colors cursor-pointer uppercase ${
              activeTab === 'emergency'
                ? 'bg-rose-950 text-rose-300 font-bold border border-rose-900'
                : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40'
            }`}
          >
            Panel Darurat
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3.5 py-2 rounded transition-colors cursor-pointer uppercase ${
              activeTab === 'export'
                ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-900'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
            }`}
          >
            Ekspor CSV
          </button>
        </nav>

        {/* Tab Contents */}
        {loading && !dashboardData ? (
          <div className="py-24 text-center text-slate-500 font-mono text-xs">
            Memuat data operasional event dari PostgreSQL...
          </div>
        ) : !dashboardData ? (
          <div className="py-16 text-center text-slate-500 font-mono text-xs">
            Belum ada data event yang dapat ditampilkan.
          </div>
        ) : (
          <div>
            {activeTab === 'overview' && <DashboardOverview data={dashboardData} />}

            {activeTab === 'event' && (
              <EventControls
                event={dashboardData.event}
                onOpenEvent={handleOpenEvent}
                onCloseEvent={handleCloseEvent}
                onForceCloseEvent={handleForceCloseEvent}
                onUpdateEvent={handleUpdateEvent}
              />
            )}

            {activeTab === 'categories' && (
              <CategoryQuotaManager
                categories={dashboardData.categories}
                onCreateCategory={handleCreateCategory}
                onUpdateCategory={handleUpdateCategory}
                onResetQuota={handleResetQuota}
                onDeleteCategory={handleDeleteCategory}
              />
            )}

            {activeTab === 'participants' && (
              <ParticipantMonitor
                participants={participants}
                onCancelSelection={handleCancelSelection}
                onRefresh={() => refreshData(selectedEventId, secret)}
              />
            )}

            {activeTab === 'emergency' && (
              <EmergencyPanel
                categories={dashboardData.categories}
                onForceCloseEvent={handleForceCloseEvent}
                onResetQuota={handleResetQuota}
                onCheckConsistency={() => adminApi.checkConsistency(secret, selectedEventId)}
              />
            )}

            {activeTab === 'export' && (
              <ExportSection data={dashboardData} onExportCsv={handleExportCsv} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
