import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PARTICIPANT_NAME_MIN_LENGTH, PARTICIPANT_NAME_MAX_LENGTH } from '@war-konsumsi/shared';

export class JoinEventDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Nama kamu wajib diisi.' })
  @IsString({ message: 'Nama harus berupa teks.' })
  @MinLength(PARTICIPANT_NAME_MIN_LENGTH, {
    message: `Nama minimal ${PARTICIPANT_NAME_MIN_LENGTH} karakter.`,
  })
  @MaxLength(PARTICIPANT_NAME_MAX_LENGTH, {
    message: `Nama maksimal ${PARTICIPANT_NAME_MAX_LENGTH} karakter.`,
  })
  name!: string;
}
