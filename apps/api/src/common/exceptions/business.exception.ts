import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(code: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ success: false, code, message }, status);
  }
}

export class QuotaExhaustedException extends BusinessException {
  constructor(message = 'Kategori baru saja habis. Pilih konsumsi lainnya.') {
    super('QUOTA_EXHAUSTED', message, HttpStatus.CONFLICT);
  }
}

export class AlreadySelectedException extends BusinessException {
  constructor(message = 'Kamu sudah memiliki pilihan.') {
    super('ALREADY_SELECTED', message, HttpStatus.CONFLICT);
  }
}

export class EventNotOpenException extends BusinessException {
  constructor(message = 'Pemilihan belum dibuka atau sudah ditutup.') {
    super('EVENT_NOT_OPEN', message, HttpStatus.BAD_REQUEST);
  }
}

export class EventNotFoundException extends BusinessException {
  constructor(message = 'Event tidak ditemukan.') {
    super('EVENT_NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
}

export class CategoryNotFoundException extends BusinessException {
  constructor(message = 'Kategori tidak ditemukan.') {
    super('CATEGORY_NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
}

export class CategoryInactiveException extends BusinessException {
  constructor(message = 'Kategori tidak aktif.') {
    super('CATEGORY_INACTIVE', message, HttpStatus.BAD_REQUEST);
  }
}

export class ParticipantNotFoundException extends BusinessException {
  constructor(message = 'Peserta tidak valid untuk event ini.') {
    super('PARTICIPANT_NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
}
