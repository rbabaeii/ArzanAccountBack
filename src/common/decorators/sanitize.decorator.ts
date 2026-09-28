import { Transform } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';

export const SanitizeText = () =>
  Transform(({ value }) =>
    typeof value === 'string'
      ? sanitizeHtml(value, {
          allowedTags: [],
          allowedAttributes: {},
        }).trim()
      : value,
  );
