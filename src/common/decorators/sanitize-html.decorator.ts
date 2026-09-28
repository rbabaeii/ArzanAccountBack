import { Transform } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';

export const SanitizeHtml = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return sanitizeHtml(value, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'h1', 'h2', 'span' ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class'],
        'img': ['src', 'alt', 'width', 'height']
      },
    }).trim();
  });
