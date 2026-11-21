import type { DimensionId, ProductId } from '#shared/domain/vocab.ts';
import type { CustomerState } from '../../design/primitives/Badge.tsx';

// Three example calls for the landing page's preview. Each is one moment: the customer has just
// spoken, the trainee has asked a question, and the coaching shows three of six skills. The people
// and organisations are invented; the preview is captioned as an example with a synthetic customer.

export interface PreviewTurn {
  speaker: 'customer' | 'you';
  text: string;
  time: string;
}

export interface PreviewCall {
  /** The tab's value and the key of its panel. */
  id: string;
  product: ProductId;
  /** The short name on the tab. */
  tab: string;
  /** The product's full name, as the call shows it. */
  productName: string;
  customer: { name: string; role: string };
  state: CustomerState;
  turns: readonly PreviewTurn[];
  scores: readonly { id: DimensionId; score: number }[];
  /** The waveform: bar heights from 0 to 100. A different shape for each customer. */
  wave: readonly number[];
}

export const PREVIEW_CALLS: readonly PreviewCall[] = [
  {
    id: 'teams',
    product: 'teams',
    tab: 'Teams',
    productName: 'Microsoft Teams',
    customer: { name: 'Maya Okafor', role: 'Front-desk coordinator' },
    state: 'concerned',
    turns: [
      {
        speaker: 'customer',
        text: 'Our meetings will not start. It just keeps spinning.',
        time: '0:08',
      },
      {
        speaker: 'you',
        text: 'I am sorry about that. Is it everyone, or only some of you?',
        time: '0:21',
      },
    ],
    scores: [
      { id: 'opening-rapport', score: 4 },
      { id: 'scoping-discovery', score: 5 },
      { id: 'empathy-deescalation', score: 3 },
    ],
    wave: [
      14, 24, 38, 30, 52, 66, 44, 28, 40, 72, 88, 60, 36, 24, 46, 78, 92, 70, 48, 32, 22, 38, 58,
      42, 26, 16, 22, 12, 18, 10, 14, 8,
    ],
  },
  {
    id: 'outlook',
    product: 'outlook',
    tab: 'Outlook',
    productName: 'Outlook',
    customer: { name: 'Daniel Reyes', role: 'Practice manager' },
    state: 'frustrated',
    turns: [
      {
        speaker: 'customer',
        text: 'We cannot open Outlook this morning, and the whole team is waiting.',
        time: '0:06',
      },
      { speaker: 'you', text: 'Thanks for calling, Daniel. When did it start?', time: '0:19' },
    ],
    scores: [
      { id: 'opening-rapport', score: 5 },
      { id: 'scoping-discovery', score: 4 },
      { id: 'empathy-deescalation', score: 4 },
    ],
    wave: [
      10, 18, 30, 46, 62, 80, 94, 76, 58, 42, 54, 70, 86, 64, 40, 26, 34, 52, 68, 50, 30, 20, 28,
      44, 36, 22, 14, 20, 12, 16, 8, 10,
    ],
  },
  {
    id: 'entra-id',
    product: 'entra-id',
    tab: 'Entra ID',
    productName: 'Microsoft Entra ID',
    customer: { name: 'Priya Nair', role: 'IT administrator' },
    state: 'recovering',
    turns: [
      {
        speaker: 'customer',
        text: 'Nobody on my team can sign in. It began around nine.',
        time: '0:11',
      },
      {
        speaker: 'you',
        text: 'Thanks, Priya. Has anything changed since yesterday?',
        time: '0:24',
      },
    ],
    scores: [
      { id: 'opening-rapport', score: 4 },
      { id: 'scoping-discovery', score: 4 },
      { id: 'empathy-deescalation', score: 5 },
    ],
    wave: [
      12, 20, 34, 48, 40, 28, 36, 56, 74, 90, 82, 62, 44, 30, 22, 32, 50, 68, 84, 72, 54, 38, 26,
      18, 24, 36, 28, 18, 12, 16, 10, 8,
    ],
  },
];
