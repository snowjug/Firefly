import type { Evidence } from '#shared/domain/report.ts';
import {
  evidenceFrom,
  firstTurns,
  hits,
  lastTurns,
  pushEvidence,
  recordedEvidence,
  type CareContext,
  type Hit,
  type TurnView,
} from './context.ts';
import { absent, harmful, partly, shown, wordCount } from './helpers.ts';
import {
  AGREEMENT_CHECK,
  ANYTHING_ELSE,
  CASE_CONTEXT,
  CHECK_BACK,
  contentWords,
  EMPATHY,
  GREETING,
  IDENTITY,
  introSignals,
  OFFERS_HELP,
  overlap,
  REFLECT_FRAME,
  SUMMARY_FRAME,
  THANKS_CLOSE,
  TIME_REF,
  UPDATE_ACTION,
} from './lexicon.ts';
import { analyses, askingSentences } from './moments.ts';
import type { BehaviourSpec } from './types.ts';

// COMMUNICATE: greeting, introduction, confirming who and what, clear questions, listening, summaries,
// plain language, pacing, checking understanding, a professional close.

const greeting: BehaviourSpec = {
  id: 'communicate.greeting',
  principle: 'communicate',
  label: () => 'Opened with a professional greeting',
  done: () => 'opened with a greeting',
  missing: () => 'did not open with a greeting',
  judge(ctx) {
    const opening = firstTurns(ctx, 2);
    const evidence = evidenceFrom(
      hits(ctx, (s) => GREETING.test(s.lower), opening),
      1,
    );
    // The classification may have heard a greeting in words the pattern does not know.
    if (evidence.length === 0) {
      for (const view of opening) {
        if (view.turn.cls.evidence.some((e) => e.behaviour === 'greeting')) {
          pushEvidence(evidence, recordedEvidence(view, 'greeting'), 1);
        }
      }
    }
    return evidence.length > 0 ? shown(evidence) : absent('No greeting in the first two turns.');
  },
};

interface IntroScan {
  name: boolean;
  team: boolean;
  found: Hit[];
}

function scanIntroduction(ctx: CareContext, turns: TurnView[]): IntroScan {
  const scan: IntroScan = { name: false, team: false, found: [] };
  for (const view of turns) {
    for (const sentence of view.sentences) {
      const s = introSignals(sentence.text);
      if (!s.lead || !(s.name || s.team || s.role)) continue;
      scan.name ||= s.name;
      scan.team ||= s.team || s.role;
      scan.found.push({ view, sentence });
    }
  }
  void ctx;
  return scan;
}

const introduction: BehaviourSpec = {
  id: 'communicate.introduction',
  principle: 'communicate',
  label: () => 'Introduced themselves by name and team',
  done: () => 'introduced yourself by name and team',
  missing: () => 'never said who you were or which team you were on',
  judge(ctx) {
    const early = scanIntroduction(ctx, firstTurns(ctx, 3));
    if (early.name && early.team) return shown(evidenceFrom(early.found));
    if (early.name || early.team) {
      return partly(
        evidenceFrom(early.found),
        early.name ? 'Gave a name but no team or role.' : 'Named a team but not yourself.',
      );
    }
    const late = scanIntroduction(ctx, ctx.turns.slice(3));
    if (late.name || late.team) {
      return partly(evidenceFrom(late.found), 'Said who you were only late in the call.');
    }
    const greeted = hits(ctx, (s) => GREETING.test(s.lower), firstTurns(ctx, 2)).length > 0;
    const offered = hits(ctx, (s) => OFFERS_HELP.test(s.lower), firstTurns(ctx, 2)).length > 0;
    return absent(
      greeted || offered
        ? 'Said hello or offered help but never gave a name or team.'
        : 'Never said who you were or which team.',
    );
  },
};

const contextConfirmed: BehaviourSpec = {
  id: 'communicate.context-confirmed',
  principle: 'communicate',
  label: (ctx) =>
    ctx.stage === 'closure'
      ? 'Confirmed the case and why the customer called'
      : 'Confirmed who they were speaking with and which case',
  done: () => 'confirmed who and what the call was about',
  missing: () => 'did not confirm the case or who was calling',
  judge(ctx) {
    const within = ctx.stage === 'first-contact' ? firstTurns(ctx, 3) : ctx.turns;
    const found = hits(ctx, (s) => IDENTITY.test(s.lower) || CASE_CONTEXT.test(s.lower), within);
    if (found.length > 0) return shown(evidenceFrom(found));
    return absent(
      ctx.stage === 'closure'
        ? 'Never confirmed the case or why the customer was calling.'
        : 'Never confirmed who was calling or which case it was.',
    );
  },
};

const clearQuestions: BehaviourSpec = {
  id: 'communicate.clear-questions',
  principle: 'communicate',
  label: () => 'Asked clear, focused questions',
  done: () => 'asked focused questions',
  missing: () => 'asked no focused question about the problem',
  judge(ctx) {
    const byTurn = new Map<TurnView, Hit>();
    for (const h of analyses(ctx).intents) if (!byTurn.has(h.view)) byTurn.set(h.view, h);
    const firsts = [...byTurn.values()];
    if (firsts.length >= 2) return shown(evidenceFrom(firsts));
    if (firsts.length === 1) {
      return partly(
        evidenceFrom(firsts),
        'Only one turn asked a focused question about the problem.',
      );
    }
    return absent('No focused question about the problem.');
  },
};

const activeListening: BehaviourSpec = {
  id: 'communicate.active-listening',
  principle: 'communicate',
  label: () => 'Reflected what the customer said',
  done: (ctx) => `reflected ${ctx.call.name}'s own words`,
  missing: () => 'did not reflect what the customer said',
  judge(ctx) {
    // Reflecting means saying back something particular the customer just said. "I hear you" with
    // nothing of theirs in it does not count.
    const found = hits(ctx, (s, view) => {
      const frame = REFLECT_FRAME.test(s.lower);
      if (s.question && !frame) return false;
      const shared = overlap(contentWords(s.text), view.previousCustomer);
      return shared >= 3 || (shared >= 2 && frame);
    });
    return found.length > 0
      ? shown(evidenceFrom(found))
      : absent('Nothing the customer said was played back in your own words.');
  },
};

const summary: BehaviourSpec = {
  id: 'communicate.summary',
  principle: 'communicate',
  label: (ctx) =>
    ctx.stage === 'closure'
      ? 'Gave a short, accurate summary of the outcome'
      : 'Summarised what they had understood',
  done: () => 'summarised accurately',
  missing: () => 'never summarised',
  judge(ctx) {
    const { summaries } = analyses(ctx);
    if (summaries.length === 0) {
      return absent(
        ctx.stage === 'closure'
          ? 'No short summary of where the case landed.'
          : 'Never played back what you had understood.',
      );
    }
    const sound = summaries.find((s) => s.grounded && !s.corrected && s.ungrounded.length === 0);
    if (sound) return shown(evidenceFrom([sound.hit], 1));
    // An incorrect or empty recap is not credited in full: it can mislead as much as it helps.
    const last = summaries[summaries.length - 1];
    if (!last) return absent('Never played back what you had understood.');
    const note = last.corrected
      ? 'The customer corrected the recap, so it did not match what they had said.'
      : last.ungrounded.length > 0
        ? 'The recap included details the customer had not given.'
        : 'The recap held too little of what had been said to check understanding.';
    return partly(evidenceFrom([last.hit], 1), note);
  },
};

const EXPLAINING_MIN_WORDS = 8;

const plainLanguage: BehaviourSpec = {
  id: 'communicate.plain-language',
  principle: 'communicate',
  label: () => 'Used language that suited the customer',
  done: () => 'kept the language suited to the customer',
  missing: () => 'used technical terms the customer could not follow',
  judge(ctx) {
    const { jargon } = analyses(ctx);
    const unexplained = jargon.filter((j) => !j.explained);
    const explained = jargon.filter((j) => j.explained);
    const turnsWith = new Set(unexplained.map((j) => j.hit.view)).size;
    // Unexplained terms matter for a customer who would not know them: always for a novice, for an
    // intermediate customer once it happens in several turns, never for an expert.
    const counts =
      ctx.proficiency === 'novice'
        ? turnsWith >= 1
        : ctx.proficiency === 'intermediate'
          ? turnsWith >= 2
          : false;
    const name = ctx.call.name;
    if (counts) {
      if (explained.length > 0) {
        return partly(
          evidenceFrom(explained.map((j) => j.hit)),
          'Some terms were put into plain words, but others were left unexplained.',
        );
      }
      return harmful(
        evidenceFrom(unexplained.map((j) => j.hit)),
        ctx.proficiency === 'novice'
          ? `Used technical terms that ${name} could not be expected to follow.`
          : 'Several turns used technical terms without explaining them.',
      );
    }
    if (explained.length > 0)
      return shown(
        evidenceFrom(
          explained.map((j) => j.hit),
          1,
        ),
      );
    if (ctx.proficiency === 'expert' && jargon.length > 0) {
      return shown(
        evidenceFrom(
          jargon.map((j) => j.hit),
          1,
        ),
        'Precise technical language suited this customer.',
      );
    }
    // No jargon: plain language shows in a sentence that actually explains something.
    const explaining = hits(
      ctx,
      (s, view) =>
        !s.question &&
        wordCount(s.text) >= EXPLAINING_MIN_WORDS &&
        // The classification's "unclear" counts hedges and fillers ("um"), which are habits of
        // speech, so it is not held against an explanation that the words themselves show.
        (EXPLANATION.test(s.lower) ||
          SUMMARY_FRAME.test(s.lower) ||
          view.turn.cls.clarity === 'clear') &&
        !EMPATHY.test(s.lower) &&
        !GREETING.test(s.lower) &&
        !THANKS_CLOSE.test(s.lower),
    );
    if (explaining.length === 0) return null;
    const longest = explaining.reduce((a, b) =>
      b.sentence.text.length > a.sentence.text.length ? b : a,
    );
    return shown(evidenceFrom([longest]));
  },
};

// Words that show something is being explained rather than asked or promised.
const EXPLANATION =
  /\b(?:because|so that|which (?:means|is)|that'?s why|that is why|the reason|what (?:happened|happens|is happening) is|it looks like|looks like|caused|due to|means that|(?:that|this|it)(?: just| simply| basically)? means|in other words|basically|the way (?:it|this) works|here'?s what)\b|, so (?:the|your|it|that|this)\b/;

const INSTRUCTION =
  /^(?:please |then |next |after that |first |now )?(?:restart|reboot|reset|clear|sign|log|open|close|go|navigate|select|click|press|type|enter|remove|delete|add|update|install|uninstall|download|check|try|run|disable|enable|send|share)\b/;
const COMPOUND_WORDS = /\b(?:what|when|where|why|how|which|who|have|did|does|is|are)\b/g;

const pacing: BehaviourSpec = {
  id: 'communicate.pacing',
  principle: 'communicate',
  label: () => 'Kept a steady pace: one thing at a time',
  done: () => 'took one thing at a time',
  missing: () => 'packed several questions or steps into one turn',
  judge(ctx) {
    // Pacing is about how the conversation is paced, never about how fast anyone speaks.
    if (ctx.turns.length < 3) return null;
    const offenders: Hit[] = [];
    for (const view of ctx.turns) {
      const asking = askingSentences(view);
      const compound = asking.find(
        (s) =>
          (s.lower.match(/\b(?:and|or)\b/g)?.length ?? 0) >= 2 &&
          (s.lower.match(COMPOUND_WORDS)?.length ?? 0) >= 3,
      );
      const steps = view.sentences.filter((s) => !s.question && INSTRUCTION.test(s.lower));
      if (asking.length >= 3 && asking[0]) offenders.push({ view, sentence: asking[0] });
      else if (compound) offenders.push({ view, sentence: compound });
      else if (steps.length >= 3 && steps[0]) offenders.push({ view, sentence: steps[0] });
    }
    if (offenders.length >= 2) {
      return absent(
        'Several turns packed more than one question or step together.',
        evidenceFrom(offenders, 1),
      );
    }
    if (offenders.length === 1) {
      return partly(
        evidenceFrom(offenders, 1),
        'One turn packed several questions or steps together.',
      );
    }
    const single = ctx.turns.find((v) => askingSentences(v).length === 1);
    const only = single ? askingSentences(single)[0] : undefined;
    return single && only ? shown(evidenceFrom([{ view: single, sentence: only }])) : null;
  },
};

const confirmsUnderstanding: BehaviourSpec = {
  id: 'communicate.confirms-understanding',
  principle: 'communicate',
  label: (ctx) =>
    ctx.stage === 'closure'
      ? 'Confirmed the customer was happy to close'
      : 'Checked the customer had followed',
  done: (ctx) =>
    ctx.stage === 'closure'
      ? 'confirmed the customer agreed to close'
      : 'checked the customer had followed',
  missing: (ctx) =>
    ctx.stage === 'closure'
      ? 'never checked the customer was happy to close'
      : 'never checked the customer had followed',
  judge(ctx) {
    if (ctx.stage === 'closure') {
      // A check is put to the customer: a question, or a sentence that speaks to "you". "I'll
      // close the case now" tells them; it does not ask.
      const found = hits(
        ctx,
        (s) =>
          (AGREEMENT_CHECK.test(s.lower) || CHECK_BACK.test(s.lower)) &&
          (s.question || /\byou\b/.test(s.lower)),
        lastTurns(ctx, 3),
      );
      return found.length > 0
        ? shown(evidenceFrom(found))
        : absent('Never checked that the customer was happy to close.');
    }
    const checks = hits(ctx, (s) => CHECK_BACK.test(s.lower));
    if (checks.length === 0) return absent('Never checked that the customer had followed.');
    // A check means something after an explanation, a plan or a recap, not on its own: either
    // another sentence of the turn carries something, or the same sentence does before the check.
    const genuine = checks.filter((h) => {
      const match = CHECK_BACK.exec(h.sentence.lower);
      const before = match ? h.sentence.lower.slice(0, match.index) : '';
      return (
        wordCount(before) >= 5 ||
        h.view.sentences.some(
          (s) => s !== h.sentence && !CHECK_BACK.test(s.lower) && wordCount(s.text) >= 5,
        )
      );
    });
    return genuine.length > 0
      ? shown(evidenceFrom(genuine))
      : partly(evidenceFrom(checks), 'The check came with nothing explained before it.');
  },
};

const professionalClose: BehaviourSpec = {
  id: 'communicate.professional-close',
  principle: 'communicate',
  label: () => 'Closed the call professionally',
  done: () => 'closed politely with a wrap-up',
  missing: () => 'ended without a polite close',
  judge(ctx) {
    const last = ctx.turns[ctx.turns.length - 1];
    if (!last || ctx.turns.length < 2) return null;
    const polite = hits(ctx, (s) => THANKS_CLOSE.test(s.lower), [last]);
    const lastTwo = lastTurns(ctx, 2);
    const wrap = hits(
      ctx,
      (s) =>
        SUMMARY_FRAME.test(s.lower) ||
        ANYTHING_ELSE.test(s.lower) ||
        (UPDATE_ACTION.test(s.lower) && TIME_REF.test(s.lower)),
      lastTwo,
    );
    const flagged = lastTwo.some((v) => {
      const c = v.turn.cls;
      return c.wrapsUp || c.confirmsNextContact || c.asksAnythingElse;
    });
    const wrapped = wrap.length > 0 || flagged;
    const evidence: Evidence[] = [];
    for (const h of [...polite, ...wrap]) pushEvidence(evidence, evidenceFrom([h], 1)[0] ?? null);
    evidence.sort((a, b) => a.turnIndex - b.turnIndex);
    if (polite.length > 0 && wrapped) return shown(evidence);
    if (polite.length > 0)
      return partly(evidence, 'A polite goodbye, but no wrap-up of what was agreed.');
    if (wrapped && evidence.length > 0) {
      return partly(evidence, 'Wrapped up what was agreed but ended without a polite close.');
    }
    return absent('The call ended without a wrap-up or a polite close.');
  },
};

export const COMMUNICATE: BehaviourSpec[] = [
  greeting,
  introduction,
  contextConfirmed,
  clearQuestions,
  activeListening,
  summary,
  plainLanguage,
  pacing,
  confirmsUnderstanding,
  professionalClose,
];
