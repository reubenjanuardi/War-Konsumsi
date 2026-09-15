import { IsNotEmpty, IsString, IsInt, Min, IsOptional, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  @IsNotEmpty({ message: 'Nama kategori tidak boleh kosong.' })
  @IsString({ message: 'Nama kategori harus berupa string.' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Deskripsi kategori harus berupa string.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'URL gambar harus berupa string.' })
  imageUrl?: string;

  @IsNotEmpty({ message: 'Quota kategori harus ditentukan.' })
  @IsInt({ message: 'Quota kategori harus berupa bilangan bulat.' })
  @Min(0, { message: 'Quota kategori tidak boleh negatif.' })
  quota!: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString({ message: 'Nama kategori harus berupa string.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Deskripsi kategori harus berupa string.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'URL gambar harus berupa string.' })
  imageUrl?: string;

  @IsOptional()
  @IsInt({ message: 'Quota kategori harus berupa bilangan bulat.' })
  @Min(0, { message: 'Quota kategori tidak boleh negatif.' })
  quota?: number;

  @IsOptional()
  @IsBoolean({ message: 'Status aktif harus bernilai boolean.' })
  isActive?: boolean;
}
