import { EVENT_CATALOG } from '@services/events/eventCatalog';
import { DomainEvent } from '@services/events/event.types';

/**
 * Platform-native formatters (SPEC-WEBHOOK-001 §11). v1 renders in a fixed
 * language (EN) aligned with the email-template policy.
 */

interface Field {
  label: string;
  value: string;
}

function eventTitle(event: DomainEvent): string {
  return EVENT_CATALOG[event.type].labels.en;
}

function eventFields(event: DomainEvent): Field[] {
  const fields: Field[] = [{ label: 'Subject', value: event.subject.name }];
  if (event.actor?.name) fields.push({ label: 'By', value: event.actor.name });
  if (event.target?.name) fields.push({ label: 'Target', value: event.target.name });
  if (event.detail) fields.push({ label: 'Detail', value: event.detail });
  return fields;
}

/** Discord embed colour per category (decimal). */
const CATEGORY_COLOR: Record<string, number> = {
  asset: 0x2563eb,
  handover: 0x7c3aed,
  custody: 0x059669,
  alert: 0xdc2626,
  user: 0x6b7280,
  import: 0xf59e0b,
  export: 0x0891b2,
};

export function formatSlack(event: DomainEvent): unknown {
  const fields = eventFields(event).map((f) => ({
    type: 'mrkdwn',
    text: `*${f.label}:*\n${f.value}`,
  }));
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: eventTitle(event), emoji: true } },
    { type: 'section', fields },
  ];
  if (event.link) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in ninjasset' },
          url: event.link,
        },
      ],
    });
  }
  return { text: eventTitle(event), blocks };
}

export function formatDiscord(event: DomainEvent): unknown {
  const category = EVENT_CATALOG[event.type].category;
  return {
    embeds: [
      {
        title: eventTitle(event),
        url: event.link ?? undefined,
        color: CATEGORY_COLOR[category] ?? 0x6b7280,
        fields: eventFields(event).map((f) => ({ name: f.label, value: f.value, inline: true })),
        timestamp: event.occurredAt,
      },
    ],
  };
}

export function formatTelegramText(event: DomainEvent): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = [`<b>${escape(eventTitle(event))}</b>`];
  for (const f of eventFields(event)) {
    lines.push(`${escape(f.label)}: ${escape(f.value)}`);
  }
  if (event.link) lines.push(`<a href="${escape(event.link)}">Open in ninjasset</a>`);
  return lines.join('\n');
}
