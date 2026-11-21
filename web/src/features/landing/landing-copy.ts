import type { DimensionId, ProductId } from '#shared/domain/vocab.ts';
import type { IconName } from '../../design/icons.tsx';

// The landing page's words and examples, in one place. Every example is made up: the people and
// their organisations do not exist, and a call preview says so. Nothing here is loaded from the
// scenario library, so the page makes no request and works with no server.

export const LANDING_TITLE = 'Firefly: practise Microsoft support calls';

export const HERO = {
  title: 'Practise Microsoft support calls safely.',
  lead: 'Speak with a realistic customer. Review evidence-based coaching after the call.',
  primary: 'Start call',
  secondary: 'View scenarios',
} as const;

/** Three connected steps. Each is a short title and at most six words under it. */
export const STEPS = [
  { icon: 'list', title: 'Choose scenario', text: 'Pick a product and issue.' },
  { icon: 'microphone', title: 'Speak naturally', text: 'Talk with a synthetic customer.' },
  { icon: 'document', title: 'Review coaching', text: 'See quotes behind every score.' },
] as const satisfies readonly { icon: IconName; title: string; text: string }[];

/** The products on the landing page, as short names: neutral marks, never logos. */
export const COVERAGE: readonly { product: ProductId; label: string }[] = [
  { product: 'teams', label: 'Teams' },
  { product: 'outlook', label: 'Outlook' },
  { product: 'entra-id', label: 'Entra ID' },
  { product: 'onedrive-business', label: 'OneDrive' },
  { product: 'sharepoint-online', label: 'SharePoint' },
  { product: 'windows-11', label: 'Windows' },
  { product: 'azure', label: 'Azure' },
  { product: 'intune', label: 'Intune' },
];

export const EVIDENCE = {
  said: 'I\u2019ll own this and update you by 3 PM.',
  coaching: 'Clear owner and update time.',
  skill: 'ownership-next-steps',
} as const satisfies { said: string; coaching: string; skill: DimensionId };

export const RESPONSIBLE_NOTE = 'Synthetic scenarios only. Coaching, not performance assessment.';

export const FINAL_TITLE = 'Start a Microsoft support call';
