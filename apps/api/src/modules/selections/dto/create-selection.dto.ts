import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateSelectionDto {
  @IsNotEmpty({ message: 'ID peserta wajib diisi.' })
  @IsUUID('4', { message: 'Format ID peserta tidak valid.' })
  participantId!: string;

  @IsNotEmpty({ message: 'ID kategori wajib diisi.' })
  @IsUUID('4', { message: 'Format ID kategori tidak valid.' })
  categoryId!: string;
}
