import type {
  AdminDashboardDto,
  AdminParticipantItemDto,
  AdminSelectionItemDto,
  EventDetailDto,
  CategoryDto,
  CreateEventDto,
  UpdateEventDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@war-konsumsi/shared';

export function getAdminApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.port === '3000') {
      return `${window.location.protocol}//${window.location.hostname}:4000`;
    }
    return window.location.origin;
  }
  return 'http://localhost:4000';
}

const SESSION_FLAG_KEY = 'war_konsumsi_admin_logged_in';

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export const adminStorage = {
  isLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SESSION_FLAG_KEY) === 'true';
  },
  setLoggedIn(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_FLAG_KEY, 'true');
  },
  clearSession(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(SESSION_FLAG_KEY);
    // Also clean up any legacy secret if previously stored
    localStorage.removeItem('war_konsumsi_admin_secret');
    sessionStorage.removeItem('war_konsumsi_admin_secret');
  },
  // Legacy compatibility getters/setters (no-op or proxy)
  getSecret(): string {
    return this.isLoggedIn() ? 'cookie-session' : '';
  },
  setSecret(_secret: string): void {
    this.setLoggedIn();
  },
  clearSecret(): void {
    this.clearSession();
  },
};

async function adminFetch<T>(
  endpoint: string,
  secret?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (secret && secret !== 'cookie-session') {
    headers.set('x-admin-secret', secret.trim());
  }
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${getAdminApiBase()}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Transmits HttpOnly cookie war_admin_token
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = json.message || 'Gagal memproses permintaan admin.';
    throw new AdminApiError(message, res.status);
  }

  return json;
}

export const adminApi = {
  async login(secret: string): Promise<boolean> {
    try {
      const res = await fetch(`${getAdminApiBase()}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ secret: secret.trim() }),
      });
      if (res.ok) {
        adminStorage.setLoggedIn();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${getAdminApiBase()}/api/admin/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore
    } finally {
      adminStorage.clearSession();
    }
  },

  async checkSession(): Promise<boolean> {
    try {
      const res = await fetch(`${getAdminApiBase()}/api/admin/auth/verify`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        adminStorage.setLoggedIn();
        return true;
      }
      adminStorage.clearSession();
      return false;
    } catch {
      return false;
    }
  },

  async verifySecret(secret: string): Promise<boolean> {
    return this.login(secret);
  },

  async checkConsistency(secret: string, eventId: string) {
    const res = await adminFetch<{
      success: boolean;
      isConsistent: boolean;
      issues: string[];
      summary: any;
      categories: any[];
    }>(`/api/admin/events/${eventId}/consistency`, secret);
    return res;
  },

  async getEvents(secret: string): Promise<EventDetailDto[]> {
    const res = await adminFetch<{ success: boolean; events: EventDetailDto[] }>(
      '/api/admin/events',
      secret,
    );
    return res.events;
  },

  async createEvent(secret: string, data: CreateEventDto): Promise<EventDetailDto> {
    const res = await adminFetch<{ success: boolean; event: EventDetailDto }>(
      '/api/admin/events',
      secret,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
    return res.event;
  },

  async updateEvent(
    secret: string,
    eventId: string,
    data: UpdateEventDto,
  ): Promise<EventDetailDto> {
    const res = await adminFetch<{ success: boolean; event: EventDetailDto }>(
      `/api/admin/events/${eventId}`,
      secret,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
    return res.event;
  },

  async getDashboard(secret: string, eventId: string): Promise<AdminDashboardDto> {
    const res = await adminFetch<{ success: boolean; data: AdminDashboardDto }>(
      `/api/admin/events/${eventId}/dashboard`,
      secret,
    );
    return res.data;
  },

  async openEvent(secret: string, eventId: string): Promise<EventDetailDto> {
    const res = await adminFetch<{ success: boolean; event: EventDetailDto }>(
      `/api/admin/events/${eventId}/open`,
      secret,
      { method: 'POST' },
    );
    return res.event;
  },

  async closeEvent(secret: string, eventId: string): Promise<EventDetailDto> {
    const res = await adminFetch<{ success: boolean; event: EventDetailDto }>(
      `/api/admin/events/${eventId}/close`,
      secret,
      { method: 'POST' },
    );
    return res.event;
  },

  async forceCloseEvent(secret: string, eventId: string): Promise<EventDetailDto> {
    const res = await adminFetch<{ success: boolean; event: EventDetailDto }>(
      `/api/admin/events/${eventId}/force-close`,
      secret,
      { method: 'POST' },
    );
    return res.event;
  },

  async getParticipants(
    secret: string,
    eventId: string,
    search?: string,
  ): Promise<AdminParticipantItemDto[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await adminFetch<{
      success: boolean;
      participants: AdminParticipantItemDto[];
    }>(`/api/admin/events/${eventId}/participants${query}`, secret);
    return res.participants;
  },

  async getSelections(secret: string, eventId: string): Promise<AdminSelectionItemDto[]> {
    const res = await adminFetch<{
      success: boolean;
      selections: AdminSelectionItemDto[];
    }>(`/api/admin/events/${eventId}/selections`, secret);
    return res.selections;
  },

  async createCategory(
    secret: string,
    eventId: string,
    data: CreateCategoryDto,
  ): Promise<CategoryDto> {
    const res = await adminFetch<{ success: boolean; category: CategoryDto }>(
      `/api/admin/events/${eventId}/categories`,
      secret,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
    return res.category;
  },

  async updateCategory(
    secret: string,
    eventId: string,
    categoryId: string,
    data: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    const res = await adminFetch<{ success: boolean; category: CategoryDto }>(
      `/api/admin/events/${eventId}/categories/${categoryId}`,
      secret,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
    return res.category;
  },

  async resetCategoryQuota(
    secret: string,
    eventId: string,
    categoryId: string,
    remainingQuota?: number,
  ): Promise<CategoryDto> {
    const res = await adminFetch<{ success: boolean; category: CategoryDto }>(
      `/api/admin/events/${eventId}/categories/${categoryId}/reset-quota`,
      secret,
      {
        method: 'POST',
        body: JSON.stringify({ remainingQuota }),
      },
    );
    return res.category;
  },

  async cancelSelection(
    secret: string,
    eventId: string,
    selectionId: string,
  ): Promise<{ success: boolean; message: string }> {
    return adminFetch<{ success: boolean; message: string }>(
      `/api/admin/events/${eventId}/selections/${selectionId}`,
      secret,
      { method: 'DELETE' },
    );
  },

  async deleteCategory(
    secret: string,
    eventId: string,
    categoryId: string,
  ): Promise<{ success: boolean; message: string }> {
    return adminFetch<{ success: boolean; message: string }>(
      `/api/admin/events/${eventId}/categories/${categoryId}`,
      secret,
      { method: 'DELETE' },
    );
  },

  async downloadExportCsv(secret: string, eventId: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (secret && secret !== 'cookie-session') {
      headers['x-admin-secret'] = secret.trim();
    }

    const res = await fetch(`${getAdminApiBase()}/api/admin/events/${eventId}/export`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const message = errJson.message || 'Gagal mengunduh file ekspor CSV.';
      throw new AdminApiError(message, res.status);
    }

    const disposition = res.headers.get('content-disposition');
    let filename = 'rekap-konsumsi.csv';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await res.blob();
    const csvBlob = new Blob([blob], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1500);
  },
};
