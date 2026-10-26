import { ImportPreviewDto } from './import-preview.dto.js';

export class ImportExecuteDto extends ImportPreviewDto {
  visibility?: string;
  createMissingTags?: string | boolean;
}
