import {
  ICategoryField,
  ICategoryFieldInput,
  ICategoryFieldPersist,
  ICategoryFieldType,
} from '@domain/_interfaces/category.interface';
import Boom from '@hapi/boom';
import categoryErrors from './categories.errors';

const FIELD_TYPES = Object.values(ICategoryFieldType);
const OPTION_TYPES: ICategoryFieldType[] = [
  ICategoryFieldType.SELECT,
  ICategoryFieldType.MULTI_SELECT,
];
const TEXT_MAX = 2000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function badRequest(message: string): Boom.Boom {
  const err = categoryErrors.badRequest(message);
  return Boom.badRequest(err.message, { code: err.code });
}

/** Lowercase snake_case key derived from a label; falls back to a positional key. */
function slugify(value: string, index: number): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return slug || `field_${index + 1}`;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Normalizes a category's field schema: validates each definition, derives a
 * stable snake_case key (unique within the category), and sequences sort order.
 */
export function normalizeFieldInputs(inputs: ICategoryFieldInput[]): ICategoryFieldPersist[] {
  const seen = new Set<string>();
  return inputs.map((input, index) => {
    const label = (input.label ?? '').trim();
    if (!label) {
      throw badRequest('Each field requires a label');
    }
    if (!FIELD_TYPES.includes(input.dataType)) {
      throw badRequest(`Invalid field type: ${String(input.dataType)}`);
    }

    let options: string[] | null = null;
    if (OPTION_TYPES.includes(input.dataType)) {
      const cleaned = Array.from(
        new Set((input.options ?? []).map((o) => String(o).trim()).filter((o) => o !== '')),
      );
      if (cleaned.length === 0) {
        throw badRequest(`Field "${label}" must define at least one option`);
      }
      options = cleaned;
    }

    let key = input.fieldKey ? slugify(input.fieldKey, index) : slugify(label, index);
    while (seen.has(key)) {
      key = `${key}_${index + 1}`;
    }
    seen.add(key);

    return {
      fieldKey: key,
      label,
      dataType: input.dataType,
      required: input.required === true,
      options,
      helpText: trimOrNull(input.helpText),
      placeholder: trimOrNull(input.placeholder),
      unit: trimOrNull(input.unit),
      sortOrder: index,
    };
  });
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Validates and coerces a single field's value against its definition. */
function coerceValue(field: ICategoryField, raw: unknown): unknown {
  switch (field.dataType) {
    case ICategoryFieldType.TEXT:
    case ICategoryFieldType.TEXTAREA: {
      if (typeof raw !== 'string') throw badRequest(`Field "${field.label}" must be text`);
      if (raw.length > TEXT_MAX) throw badRequest(`Field "${field.label}" is too long`);
      return raw;
    }
    case ICategoryFieldType.NUMBER: {
      const num = typeof raw === 'string' ? Number(raw) : raw;
      if (typeof num !== 'number' || Number.isNaN(num)) {
        throw badRequest(`Field "${field.label}" must be a number`);
      }
      return num;
    }
    case ICategoryFieldType.BOOLEAN: {
      if (typeof raw !== 'boolean') throw badRequest(`Field "${field.label}" must be true or false`);
      return raw;
    }
    case ICategoryFieldType.DATE: {
      if (typeof raw !== 'string' || !ISO_DATE.test(raw)) {
        throw badRequest(`Field "${field.label}" must be a date (YYYY-MM-DD)`);
      }
      return raw;
    }
    case ICategoryFieldType.SELECT: {
      if (typeof raw !== 'string' || !(field.options ?? []).includes(raw)) {
        throw badRequest(`Field "${field.label}" has an invalid option`);
      }
      return raw;
    }
    case ICategoryFieldType.MULTI_SELECT: {
      if (!Array.isArray(raw)) throw badRequest(`Field "${field.label}" must be a list`);
      const allowed = field.options ?? [];
      for (const item of raw) {
        if (typeof item !== 'string' || !allowed.includes(item)) {
          throw badRequest(`Field "${field.label}" has an invalid option`);
        }
      }
      return raw;
    }
    default:
      throw badRequest(`Field "${field.label}" has an unsupported type`);
  }
}

/**
 * Validates an asset's custom-field values against a category's schema.
 *
 * - When no category is linked, the map must be empty.
 * - `dropUnknown=false` (explicit client submit) rejects keys not in the schema;
 *   `dropUnknown=true` (carrying values across a category change) silently drops them.
 * - Required fields must be present; values are type-checked/coerced.
 *
 * Returns the sanitized map to persist.
 */
export function validateCustomFields(
  fields: ICategoryField[] | null,
  customFields: Record<string, unknown> | null | undefined,
  options: { dropUnknown: boolean },
): Record<string, unknown> {
  const input = customFields ?? {};

  if (!fields) {
    // No category: an explicit non-empty submit is an error, but values carried
    // over from a previous category (dropUnknown) are simply dropped.
    if (!options.dropUnknown && Object.keys(input).length > 0) {
      throw badRequest('Custom fields require a category');
    }
    return {};
  }

  const byKey = new Map(fields.map((f) => [f.fieldKey, f]));

  if (!options.dropUnknown) {
    for (const key of Object.keys(input)) {
      if (!byKey.has(key)) {
        throw badRequest(`Unknown custom field: ${key}`);
      }
    }
  }

  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = input[field.fieldKey];
    if (isEmpty(raw)) {
      if (field.required) {
        throw badRequest(`Field "${field.label}" is required`);
      }
      continue;
    }
    out[field.fieldKey] = coerceValue(field, raw);
  }
  return out;
}
