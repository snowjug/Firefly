import {
  emptyClassification,
  type EvidenceBehaviour,
  type TurnClassification,
} from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import { DISCOVERY_INTENTS, type DiscoveryIntent } from '#shared/domain/vocab.ts';
import {
  ANYTHING_ELSE,
  BLAME,
  BLAME_MORE,
  clip,
  contentWords,
  CORRECTS_ASSUMPTION,
  DISMISSIVE,
  DISMISSIVE_MORE,
  EMPATHY_GENERIC,
  EMPATHY_SPECIFIC_FRAME,
  GREETING,
  hasSpecificNextSteps,
  HEDGES,
  IMPACT_ACK,
  INJECTION,
  INTENT_PATTERNS,
  isHousekeepingQuestion,
  isUnverifiedPromise,
  JARGON_EXPLAINED,
  JARGON_TERMS,
  FILLER_ADVERBS,
  LOW_EFFORT,
  NEXT_CONTACT,
  NEXT_STEPS_VAGUE,
  OFFERS_HELP,
  OWNERSHIP_ACTION,
  OWNERSHIP_CLEAR,
  OWNERSHIP_VAGUE,
  prep,
  PROMISE_REALISTIC,
  QUESTION_START,
  REQUEST_PHRASE,
  SELF_INTRO,
  splitSentences,
  STRUCTURE_MARKERS,
  SUMMARISES,
  THANKS_CLOSE,
  TROUBLESHOOTING,
  WRAPS_UP,
} from './lexicon.ts';
import { cueMatches, withoutContactTalk } from './textutil.ts';

// Demo-mode classifier: describes what the trainee did in one turn using bounded pattern rules.
// It is an approximation of what a model classifier does in live mode, and it returns the same
// structure. Quotes in `evidence` are always verbatim parts of the trainee's text.

export interface ClassifierContext {
  scenario: EffectiveScenario;
  traineeTurnNumber: number;
}

const situationCache = new WeakMap<EffectiveScenario, Set<string>>();

function situationWords(scenario: EffectiveScenario): Set<string> {
  let words = situationCache.get(scenario);
  if (!words) {
    const v = scenario.impactVariant;
    words = new Set(
      contentWords(
        [v.summary, v.detail, v.deadline ?? '', scenario.customerObjective, scenario.title].join(
          ' ',
        ),
      ),
    );
    for (const w of [
      'team',
      'patients',
      'customers',
      'deadline',
      'morning',
      'appointments',
      'orders',
      'launch',
      'event',
      'investors',
      'deliverable',
      'report',
      'meeting',
      'users',
      'staff',
      'clients',
      'today',
      'hours',
      'bookings',
    ]) {
      words.add(w);
    }
    situationCache.set(scenario, words);
  }
  return words;
}

function mentionsSituation(sentenceLower: string, scenario: EffectiveScenario): boolean {
  const words = situationWords(scenario);
  return (sentenceLower.match(/[a-z]{4,}/g) ?? []).some((w) => words.has(w));
}

function isQuestionSentence(sentence: string): boolean {
  const lower = prep(sentence);
  return sentence.trim().endsWith('?') || QUESTION_START.test(lower) || REQUEST_PHRASE.test(lower);
}

export function detectIntents(sentenceLower: string): DiscoveryIntent[] {
  // "What exactly happens when..." is the same question as "What happens when...", so each pattern
  // is tried on the sentence as written and with filler adverbs removed.
  const stripped = sentenceLower.replace(FILLER_ADVERBS, '');
  return DISCOVERY_INTENTS.filter((intent) =>
    INTENT_PATTERNS[intent].some(
      (pattern) => pattern.test(sentenceLower) || pattern.test(stripped),
    ),
  );
}

export function classifyTurnRules(text: string, ctx: ClassifierContext): TurnClassification {
  const raw = text.replace(/\s+/g, ' ').trim();
  const sentences = splitSentences(raw);
  const lowerAll = prep(raw);
  const out = emptyClassification();
  const evidence: TurnClassification['evidence'] = [];
  const note = (behaviour: EvidenceBehaviour, sentence: string) => {
    if (evidence.filter((e) => e.behaviour === behaviour).length < 2) {
      evidence.push({ behaviour, quote: clip(sentence) });
    }
  };

  const words = (lowerAll.match(/[a-z0-9']+/g) ?? []).length;
  const intents = new Set<DiscoveryIntent>();
  const questionTexts: string[] = [];
  let empathy = 'none' as TurnClassification['empathy'];
  let ownership = 'none' as TurnClassification['ownership'];
  let nextSteps = 'none' as TurnClassification['nextSteps'];
  let promise = 'none' as TurnClassification['promise'];
  let jargon = 'none' as TurnClassification['jargon'];

  sentences.forEach((sentence, i) => {
    const ls = prep(sentence);
    const question = isQuestionSentence(sentence);
    const asking = sentence.trim().endsWith('?');

    if (question) {
      out.askedQuestion = true;
      if (!isHousekeepingQuestion(ls)) {
        questionTexts.push(ls);
        const found = detectIntents(withoutContactTalk(ls));
        for (const intent of found) intents.add(intent);
        if (found.length > 0) note('discovery-question', sentence);
      }
    }

    if (GREETING.test(ls)) {
      out.introduces = true;
      note('greeting', sentence);
    }
    if (SELF_INTRO.test(ls)) {
      out.introduces = true;
      note('introduction', sentence);
    }
    if (OFFERS_HELP.test(ls)) {
      out.introduces = true;
      note('offers-help', sentence);
    }

    if (EMPATHY_GENERIC.test(ls)) {
      const namesSituation = mentionsSituation(ls, ctx.scenario);
      const specific = EMPATHY_SPECIFIC_FRAME.test(ls) || namesSituation;
      if (specific) {
        empathy = 'specific';
        note('empathy-specific', sentence);
        // Naming the customer's situation while showing empathy also acknowledges the impact.
        if (namesSituation && !asking) {
          out.acknowledgesImpact = true;
          note('impact-acknowledged', sentence);
        }
      } else {
        if (empathy === 'none') empathy = 'generic';
        note('empathy-generic', sentence);
      }
    }

    if (!asking && IMPACT_ACK.some((p) => p.test(ls))) {
      out.acknowledgesImpact = true;
      note('impact-acknowledged', sentence);
    }

    if (!asking) {
      if (OWNERSHIP_CLEAR.test(ls) || OWNERSHIP_ACTION.test(ls)) {
        ownership = 'clear';
        note('ownership-clear', sentence);
      } else if (OWNERSHIP_VAGUE.test(ls)) {
        if (ownership === 'none') ownership = 'vague';
        note('ownership-vague', sentence);
      }
    }

    if (hasSpecificNextSteps(ls)) {
      nextSteps = 'specific';
      note('next-steps-specific', sentence);
      if (
        /\b(?:call|phone|text|ping|email|update|contact|ring|message|check in|speak|get back)\b/.test(
          ls,
        )
      ) {
        out.confirmsNextContact = true;
        note('next-contact', sentence);
      }
    } else if (NEXT_STEPS_VAGUE.test(ls)) {
      if (nextSteps === 'none') nextSteps = 'vague';
      note('next-steps-vague', sentence);
    }
    if (NEXT_CONTACT.test(ls) && /\b(?:at|by|in|on|tomorrow|today|this)\b/.test(ls)) {
      out.confirmsNextContact = true;
    }

    if (PROMISE_REALISTIC.test(ls)) {
      if (promise === 'none') promise = 'realistic';
      note('promise-realistic', sentence);
    } else if (!asking && isUnverifiedPromise(ls)) {
      promise = 'unverified';
      note('promise-unverified', sentence);
    }

    if (!asking && (BLAME.test(ls) || BLAME_MORE.some((p) => p.test(ls)))) {
      out.blame = true;
      note('blame', sentence);
    }
    if (DISMISSIVE.test(ls) || DISMISSIVE_MORE.some((p) => p.test(ls))) {
      out.dismissive = true;
      note('dismissive', sentence);
    }

    const terms = ls.match(JARGON_TERMS);
    if (terms && terms.length > 0) {
      const explained =
        JARGON_EXPLAINED.test(ls) ||
        (sentences[i + 1] !== undefined && JARGON_EXPLAINED.test(prep(sentences[i + 1] as string)));
      if (explained) {
        if (jargon === 'none') jargon = 'explained';
        note('jargon-explained', sentence);
      } else {
        jargon = 'unexplained';
        note('jargon-unexplained', sentence);
      }
    }

    if (SUMMARISES.test(ls)) {
      out.summarises = true;
      note('summary', sentence);
    }
    if (!asking && TROUBLESHOOTING.test(ls)) {
      out.troubleshooting = true;
      note('troubleshooting', sentence);
    }
    if (WRAPS_UP.test(ls)) {
      out.wrapsUp = true;
      note('wrap-up', sentence);
    }
    if (ANYTHING_ELSE.test(ls)) {
      out.asksAnythingElse = true;
      note('anything-else', sentence);
    }
    if (THANKS_CLOSE.test(ls)) note('thanks', sentence);
    if (CORRECTS_ASSUMPTION.test(ls)) {
      out.correctsAssumption = true;
      note('corrects-assumption', sentence);
    }
  });

  out.discoveryIntents = [...intents];
  out.empathy = empathy;
  out.ownership = ownership;
  out.nextSteps = nextSteps;
  out.promise = promise;
  out.jargon = jargon;
  out.injectionAttempt = INJECTION.test(lowerAll);
  out.lowEffort = words <= 3 && LOW_EFFORT.test(lowerAll);
  if (out.lowEffort) note('low-effort', raw);

  // Hidden facts the question addressed: a topic match, narrowed by cues when the fact has them.
  // Cues only count where the trainee is asking, so "your CEO is presenting" or "the best phone
  // number to reach you" in a statement does not reveal a fact about the CEO or a phone.
  const askedText = withoutContactTalk(questionTexts.join(' '));
  for (const fact of ctx.scenario.hiddenFacts) {
    const intentHit = fact.intents.some((intent) => intents.has(intent));
    const hasCues = (fact.cues?.length ?? 0) > 0;
    const cueHit = (fact.cues ?? []).some((cue) => cueMatches(askedText, cue));
    if (out.askedQuestion && ((intentHit && (!hasCues || cueHit)) || cueHit)) {
      out.factTargets.push({ id: fact.id, strength: 'full' });
    } else if (
      fact.partialStatement &&
      (fact.partialIntents ?? []).some((intent) => intents.has(intent))
    ) {
      out.factTargets.push({ id: fact.id, strength: 'partial' });
    }
  }

  // Clarity: never penalise brevity or phrasing; only run-on or heavily hedged messages.
  const sentenceWords = sentences.map((s) => (prep(s).match(/[a-z0-9']+/g) ?? []).length);
  const avgLen = sentenceWords.length
    ? sentenceWords.reduce((a, b) => a + b, 0) / sentenceWords.length
    : 0;
  const hedges = (lowerAll.match(HEDGES) ?? []).length;
  if (avgLen > 38 || hedges >= 3 || (words > 45 && sentences.length === 1)) {
    out.clarity = 'unclear';
  } else if (
    (STRUCTURE_MARKERS.test(lowerAll) || out.summarises || jargon === 'explained') &&
    avgLen <= 24 &&
    hedges <= 1 &&
    words >= 8
  ) {
    out.clarity = 'clear';
  } else {
    out.clarity = 'adequate';
  }

  out.confidence = words < 3 ? 0.5 : 0.7;
  out.evidence = evidence;
  return out;
}
