import { ImportTooLargeException } from '../../common/exceptions/imports/import-too-large.exception.js';
import {
  IMPORT_MAX_PATH_DEPTH,
  IMPORT_MAX_PATH_LENGTH,
} from '../../common/variables.global.js';

export function assertImportPathLimits(path: string): void {
  if (
    path.length > IMPORT_MAX_PATH_LENGTH ||
    path.split('/', IMPORT_MAX_PATH_DEPTH + 2).length >
      IMPORT_MAX_PATH_DEPTH + 1
  ) {
    throw new ImportTooLargeException(
      `File paths must not exceed ${IMPORT_MAX_PATH_LENGTH} characters nor ${IMPORT_MAX_PATH_DEPTH} nested folders`,
    );
  }
}
