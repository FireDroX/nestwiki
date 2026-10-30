import { ApiProperty } from '@nestjs/swagger';
import { PAGE_VISIBILITIES } from '../../entities/page.entity.js';
import type { PageVisibility } from '../../entities/page.entity.js';

export class CreatePageDto {
  slug: string;
  title: string;
  content: string;
  parentId?: string | null;

  @ApiProperty({
    enum: PAGE_VISIBILITIES,
    required: false,
    description:
      'Absent : celle de la page parente (private à la racine). public sous un parent privé ou à la racine exige page.manage_visibility.',
  })
  visibility?: PageVisibility;
}
