import type {
  EventDetailDto,
  CategoryDto,
  ParticipantDto,
  SelectionDto,
  ParticipantSelectionResponseDto,
} from '@war-konsumsi/shared';

export function getApiBase(): string {
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

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = json.message || 'Terjadi kesalahan pada sistem.';
    const code = json.code || 'UNKNOWN_ERROR';
    throw new ApiError(message, code, res.status);
  }

  return json;
}

export const api = {
  async getCurrentEvent(): Promise<EventDetailDto> {
    const res = await fetch(`${getApiBase()}/api/events/current`, {
      cache: 'no-store',
    });
    const data = await handleResponse<{ success: boolean; event: EventDetailDto }>(res);
    return data.event;
  },

  async getEvent(eventId: string): Promise<EventDetailDto> {
    const res = await fetch(`${getApiBase()}/api/events/${eventId}`, {
      cache: 'no-store',
    });
    const data = await handleResponse<{ success: boolean; event: EventDetailDto }>(res);
    return data.event;
  },

  async getCategories(eventId: string): Promise<CategoryDto[]> {
    const res = await fetch(`${getApiBase()}/api/events/${eventId}/categories`, {
      cache: 'no-store',
    });
    const data = await handleResponse<{ success: boolean; categories: CategoryDto[] }>(res);
    return data.categories;
  },

  async joinEvent(eventId: string, name: string): Promise<ParticipantDto> {
    const res = await fetch(`${getApiBase()}/api/events/${eventId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await handleResponse<{ success: boolean; participant: ParticipantDto }>(res);
    return data.participant;
  },

  async createSelection(
    eventId: string,
    participantId: string,
    categoryId: string,
  ): Promise<SelectionDto> {
    const res = await fetch(`${getApiBase()}/api/events/${eventId}/selections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, categoryId }),
    });
    const data = await handleResponse<{ success: boolean; selection: SelectionDto }>(res);
    return data.selection;
  },

  async getParticipantSelection(
    eventId: string,
    participantId: string,
  ): Promise<ParticipantSelectionResponseDto> {
    const res = await fetch(
      `${getApiBase()}/api/events/${eventId}/participants/${participantId}/selection`,
      { cache: 'no-store' },
    );
    return await handleResponse<ParticipantSelectionResponseDto>(res);
  },
};
