/**
 * The single source of truth for domain events (SPEC-WEBHOOK-001 §6.2).
 *
 * Every event MUST have a category, EN+ES labels, and a `defaultSubscribed`
 * hint. Because `EVENT_CATALOG` is `satisfies Record<string, EventDef>` and
 * `EventType = keyof typeof EVENT_CATALOG`, the compiler refuses an entry that
 * is missing any metadata, and every consumer keyed by `EventType` (the webhook
 * formatter map, `eventBus.publish`) gets compile-time exhaustiveness. A thin
 * runtime test (events.catalog.test) covers what types cannot — non-empty
 * labels and formatter coverage.
 */
export type EventCategory = 'asset' | 'handover' | 'custody' | 'alert' | 'user' | 'import' | 'export';

export interface EventLabels {
  en: string;
  es: string;
}

export interface EventDef {
  category: EventCategory;
  labels: EventLabels;
  /** Suggested default when an admin creates a new destination. */
  defaultSubscribed: boolean;
}

export const EVENT_CATALOG = {
  // --- asset lifecycle (maps from ITransactionAction) ---
  'asset.created': {
    category: 'asset',
    labels: { en: 'Asset created', es: 'Activo creado' },
    defaultSubscribed: false,
  },
  'asset.assigned': {
    category: 'asset',
    labels: { en: 'Asset assigned', es: 'Activo asignado' },
    defaultSubscribed: true,
  },
  'asset.unassigned': {
    category: 'asset',
    labels: { en: 'Asset unassigned', es: 'Activo liberado' },
    defaultSubscribed: true,
  },
  'asset.status_changed': {
    category: 'asset',
    labels: { en: 'Asset status changed', es: 'Estado de activo cambiado' },
    defaultSubscribed: false,
  },
  'asset.site_changed': {
    category: 'asset',
    labels: { en: 'Asset site changed', es: 'Sitio de activo cambiado' },
    defaultSubscribed: false,
  },
  'asset.deleted': {
    category: 'asset',
    labels: { en: 'Asset deleted', es: 'Activo eliminado' },
    defaultSubscribed: false,
  },
  // --- handover / custody ---
  'handover.created': {
    category: 'handover',
    labels: { en: 'Handover started', es: 'Traspaso iniciado' },
    defaultSubscribed: true,
  },
  'handover.cancelled': {
    category: 'handover',
    labels: { en: 'Handover cancelled', es: 'Traspaso cancelado' },
    defaultSubscribed: false,
  },
  'custody.accepted': {
    category: 'custody',
    labels: { en: 'Custody accepted', es: 'Custodia aceptada' },
    defaultSubscribed: true,
  },
  'custody.completed_on_behalf': {
    category: 'custody',
    labels: { en: 'Custody completed on behalf', es: 'Custodia completada en nombre de' },
    defaultSubscribed: false,
  },
  // --- data-quality alerts (periodic scan, §9.3) ---
  'alert.raised': {
    category: 'alert',
    labels: { en: 'Data-quality alert raised', es: 'Alerta de calidad de datos' },
    defaultSubscribed: true,
  },
  // --- user & auth (no audit-log equivalent today, §9.2) ---
  'user.registered': {
    category: 'user',
    labels: { en: 'User registered', es: 'Usuario registrado' },
    defaultSubscribed: false,
  },
  'user.created': {
    category: 'user',
    labels: { en: 'User created by admin', es: 'Usuario creado por administrador' },
    defaultSubscribed: false,
  },
  'user.deleted': {
    category: 'user',
    labels: { en: 'User deleted', es: 'Usuario eliminado' },
    defaultSubscribed: false,
  },
  'user.locked': {
    category: 'user',
    labels: { en: 'Account locked', es: 'Cuenta bloqueada' },
    defaultSubscribed: false,
  },
  // --- import / export jobs (async worker completion, SPEC-IMPORT-001) ---
  'import.dry_run_completed': {
    category: 'import',
    labels: { en: 'Import dry-run completed', es: 'Simulación de importación completada' },
    defaultSubscribed: false,
  },
  'import.commit_completed': {
    category: 'import',
    labels: { en: 'Import commit completed', es: 'Importación confirmada completada' },
    defaultSubscribed: true,
  },
  'export.completed': {
    category: 'export',
    labels: { en: 'Export completed', es: 'Exportación completada' },
    defaultSubscribed: true,
  },
} satisfies Record<string, EventDef>;

export type EventType = keyof typeof EVENT_CATALOG;

/** All event types, ordered as declared. */
export const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[];

export function isEventType(value: string): value is EventType {
  return Object.prototype.hasOwnProperty.call(EVENT_CATALOG, value);
}
