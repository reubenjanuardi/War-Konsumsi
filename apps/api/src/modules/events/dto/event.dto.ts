import { IsNotEmpty, IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { EventStatus } from '@war-konsumsi/shared';

export class CreateEventDto {
  @IsNotEmpty({ message: 'Nama event tidak boleh kosong.' })
  @IsString({ message: 'Nama event harus berupa string.' })
  name!: string;

  @IsNotEmpty({ message: 'Waktu mulai pemilihan harus ditentukan.' })
  @IsDateString({}, { message: 'Format waktu mulai pemilihan tidak valid.' })
  selectionStartsAt!: string;

  @IsOptional()
  @IsDateString({}, { message: 'Format waktu selesai pemilihan tidak valid.' })
  selectionEndsAt?: string;

  @IsOptional()
  @IsEnum(EventStatus, { message: 'Status event tidak valid.' })
  status?: EventStatus;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString({ message: 'Nama event harus berupa string.' })
  name?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Format waktu mulai pemilihan tidak valid.' })
  selectionStartsAt?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Format waktu selesai pemilihan tidak valid.' })
  selectionEndsAt?: string;

  @IsOptional()
  @IsEnum(EventStatus, { message: 'Status event tidak valid.' })
  status?: EventStatus;
}
