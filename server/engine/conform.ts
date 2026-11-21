import { normalizeWhitespace, sentences } from '#shared/domain/text.ts';

// The last step before a customer reply is used, for a reply from the rules engine and for one from
// a model alike. A real customer on the phone keeps it short, never praises the engineer, never
// tells them what to ask, never announces what they are holding back, and speaks in sentences
// rather than lists or headings. A model drifts from this now and then, so every reply is checked:
//
//   too long    cut at a sentence boundary, never in the middle of a sentence
//   formatting  list markers, headings and line breaks are flattened into plain speech
//   praise      "great question" and "well done" are removed, "that's correct" becomes "that's right"
//   coaching    "you should ask me about..." is removed, and so is announcing a hidden fact
//
// The result is always usable text, or empty when nothing of the reply could be kept. `problems`
// lists what was found even when it was repaired, so a caller can ask a model to try again when the
// reply could not be saved.

export type ConformProblem =
  'too-long' | 'list-or-heading' | 'praise' | 'coaching' | 'announces-facts' | 'empty';

export interface ConformOptions {
  /** Most sentences the reply may have (see `ReplyPlan.maxSentences`). */
  maxSentences: number;
  /** Most characters, as a second limit for a very long sentence. */
  maxChars?: number;
}

export interface ConformResult {
  text: string;
  changed: boolean;
  problems: ConformProblem[];
}

const LIST_MARKER = /^[ \t]*(?:[-*\u2022]|\d{1,2}[.)]|#{1,6}|>)[ \t]+/;

// Praise at the start of a sentence: "Great question.", "Good point, ..." and the like.
const PRAISE_LEAD =
  /^(?:(?:oh|well|ah|ok(?:ay)?|right|yes|yeah|great|good|excellent|brilliant|fantastic|perfect|lovely|nice)[,!.]?\s+)*(?:that(?:'s| is) )?(?:an? |such an? )?(?:very |really |truly )?(?:great|good|excellent|fantastic|brilliant|perfect|fair|smart|sharp|clever|insightful|helpful|valid|astute)\s+(?:question|point|catch|observation|suggestion|idea|thinking|call)\b[,.!:;]?\s*/i;
const PRAISE =
  /\b(?:well done|good job|great job|nicely done|nice work|excellent work|good work|you(?:'re| are) doing (?:great|well|a (?:great|good) job)|you did (?:great|well|a (?:great|good) job)|spot on|bingo)\b/i;
const THATS_CORRECT = /\bthat(?:'s| is) (?:absolutely |completely |entirely |exactly )?correct\b/i;

const COACHING =
  /\byou (?:should|could|might want to|need to|ought to|might like to|may want to) (?:have )?(?:ask|asked|check|try asking|be asking)\b|\btry (?:to )?ask(?:ing)?\b|\bask me (?:about|whether|if|what|how|when|where|who)\b|\b(?:a|the) (?:better|good|right|great) question (?:would|to ask|is)\b|\bwhat you should (?:have )?ask(?:ed)?\b|\bnext time\b[^.?!]{0,30}\b(?:ask|try|say)\b|\bi(?:'d| would) suggest (?:you )?(?:ask|check|try)\b|(?:^|\s)(?:hint|tip)\s*:/i;
const ANNOUNCES =
  /\bhidden facts?\b|\banother (?:hidden )?fact\b|\bi(?:'ll| will| can| could) (?:now )?(?:reveal|disclose)\b|\bhere(?:'s| is) (?:another|a|the next) (?:hidden )?(?:fact|detail|clue)\b|\bnext (?:fact|clue)\b/i;

/** Splits into lines, strips list and heading markers, and ends each line as a sentence. */
function flatten(input: string): { text: string; markers: number } {
  let markers = 0;
  const lines = input.split(/\r?\n/).flatMap((line) => {
    const stripped = line.replace(LIST_MARKER, () => {
      markers += 1;
      return '';
    });
    const trimmed = stripped.trim();
    if (trimmed === '') return [];
    return [/[.!?\u2026]["')\u201d]?$/.test(trimmed) ? trimmed : `${trimmed}.`];
  });
  return { text: lines.join(' '), markers };
}

export function conformCustomerReply(input: string, options: ConformOptions): ConformResult {
  const problems = new Set<ConformProblem>();
  const { text: flat, markers } = flatten(input);
  if (markers > 0) problems.add('list-or-heading');

  const kept: string[] = [];
  for (const raw of sentences(flat)) {
    let sentence = raw;
    if (PRAISE_LEAD.test(sentence)) {
      problems.add('praise');
      sentence = sentence.replace(PRAISE_LEAD, '').trim();
      if (sentence !== '') sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    }
    if (sentence === '' || /^[^A-Za-z0-9]+$/.test(sentence)) continue;
    if (PRAISE.test(sentence)) {
      problems.add('praise');
      continue;
    }
    if (THATS_CORRECT.test(sentence)) {
      problems.add('praise');
      sentence = sentence.replace(new RegExp(THATS_CORRECT.source, 'gi'), (m) =>
        m[0] === 'T' ? "That's right" : "that's right",
      );
    }
    if (COACHING.test(sentence)) {
      problems.add('coaching');
      continue;
    }
    if (ANNOUNCES.test(sentence)) {
      problems.add('announces-facts');
      continue;
    }
    kept.push(sentence);
  }

  let result = kept;
  if (result.length > options.maxSentences) {
    problems.add('too-long');
    result = result.slice(0, Math.max(1, options.maxSentences));
  }
  const maxChars = options.maxChars;
  if (maxChars !== undefined) {
    while (result.length > 1 && result.join(' ').length > maxChars) {
      problems.add('too-long');
      result = result.slice(0, -1);
    }
  }
  const text = result.join(' ').trim();
  if (text === '') problems.add('empty');
  return {
    text,
    changed: text !== normalizeWhitespace(input),
    problems: [...problems],
  };
}

/** How many sentences a reply has, counted the way the limits are. */
export function sentenceCount(text: string): number {
  return sentences(text).length;
}
