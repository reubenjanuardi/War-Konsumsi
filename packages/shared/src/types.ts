import { EventStatus, CategoryStatus } from './enums.js';

export interface EventDto {
  id: string;
  name: string;
  status: EventStatus;
  selectionStartsAt: string;
  selectionEndsAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventDetailDto extends EventDto {
  serverTime: string;
}

export interface CategoryDto {
  id: string;
  eventId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  quota: number;
  remainingQuota: number;
  status: CategoryStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantDto {
  id: string;
  eventId: string;
  name: string;
  createdAt: string;
}

export interface SelectionDto {
  id: string;
  eventId: string;
  participantId: string;
  categoryId: string;
  selectedAt: string;
  categoryName?: string;
}

export interface ParticipantSelectionResponseDto {
  hasSelected: boolean;
  selection: SelectionDto | null;
}

export interface JoinEventDto {
  name: string;
}

export interface CreateSelectionDto {
  participantId: string;
  categoryId: string;
}

export interface HealthResponseDto {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'connected' | 'disconnected';
  uptimeSeconds: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export interface CreateEventDto {
  name: string;
  selectionStartsAt: string;
  selectionEndsAt?: string | null;
  status?: EventStatus;
}

export interface UpdateEventDto {
  name?: string;
  selectionStartsAt?: string;
  selectionEndsAt?: string | null;
  status?: EventStatus;
}

export interface CreateCategoryDto {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  quota: number;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  quota?: number;
  isActive?: boolean;
}

export interface CategoryQuotaUpdatedPayload {
  categoryId: string;
  remainingQuota: number;
  status: CategoryStatus;
}

export interface EventStatusUpdatedPayload {
  eventId: string;
  status: EventStatus;
}

export interface AdminDashboardDto {
  event: EventDetailDto;
  totalParticipants: number;
  selectedParticipants: number;
  unselectedParticipants: number;
  totalQuota: number;
  totalRemainingQuota: number;
  soldOutCategoriesCount: number;
  categories: CategoryDto[];
}

export interface AdminParticipantItemDto {
  id: string;
  eventId: string;
  name: string;
  createdAt: string;
  selection: {
    id: string;
    categoryId: string;
    categoryName: string;
    selectedAt: string;
  } | null;
}

export interface AdminSelectionItemDto {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  categoryId: string;
  categoryName: string;
  selectedAt: string;
}

export interface ResetQuotaDto {
  remainingQuota?: number;
}

