import type { DiscoveryIntent } from '#shared/domain/vocab.ts';
import { evidenceFrom, hits, recordedEvidence, type Hit, type TurnView } from './context.ts';
import { absent, harmful, needed, partly, shown } from './helpers.ts';
import {
  CUSTOMER_WANTS_ESCALATION,
  contentWords,
  ESCALATION,
  ESCALATION_EXPLAINED,
  FIRST_PERSON_COMMIT,
  HISTORY,
  norm,
  overlap,
  RESOLUTION_CHECK,
  WE_COMMIT,
} from './lexicon.ts';
import { analyses, askedAbout, type Analyses, type IntentHit } from './moments.ts';
import type { BehaviourSpec } from './types.ts';
import { repeatEvidence } from './violations.ts';

// RESOURCEFUL: a logical investigation, relevant scoping, impact, environment, recent changes,
// what was already tried, use of what is known, escalation when it is warranted, and no repeats.

/** The first question about each topic group, one per turn, in call order. */
function firstPerTurn(found: IntentHit[]): Hit[] {
  const byTurn = new Map<TurnView, Hit>();
  for (const h of found) if (!byTurn.has(h.view)) byTurn.set(h.view, h);
  return [...byTurn.values()];
}

const topicsAsked = (a: Analyses): Set<DiscoveryIntent> =>
  new Set(a.intents.flatMap((h) => h.intents));

const logicalInvestigation: BehaviourSpec = {
  id: 'resourceful.logical-investigation',
  principle: 'resourceful',
  label: (ctx) =>
    ctx.stage === 'closure'
      ? 'Checked that the fix really worked'
      : 'Investigated in a logical order',
  done: (ctx) =>
    ctx.stage === 'closure' ? 'checked the fix really worked' : 'investigated in a logical order',
  missing: (ctx) =>
    ctx.stage === 'closure'
      ? 'never checked the fix really worked'
      : 'did not investigate in a logical order',
  judge(ctx) {
    if (ctx.stage === 'closure') {
      const checks = hits(ctx, (s) => RESOLUTION_CHECK.test(s.lower));
      return checks.length > 0
        ? shown(evidenceFrom(checks))
        : absent('Never checked that the fix really worked.');
    }
    const a = analyses(ctx);
    const topics = topicsAsked(a);
    const fix = ctx.turns.find((v) => v.turn.cls.troubleshooting);
    let premature = ctx.call.events.some((e) => e.category === 'premature-troubleshooting');
    if (fix && fix.turn.number <= 3) {
      const byThen = new Set(
        a.intents.filter((h) => h.view.turn.index <= fix.turn.index).flatMap((h) => h.intents),
      );
      if (byThen.size < 2) premature = true;
    }
    const questions = firstPerTurn(a.intents);
    if (topics.size === 0) {
      const quote = fix ? recordedEvidence(fix, 'troubleshooting') : null;
      return absent(
        fix
          ? 'Went straight to fixes without asking about the problem.'
          : 'Asked nothing about the problem.',
        quote ? [quote] : [],
      );
    }
    if (premature) {
      return partly(evidenceFrom(questions), 'Offered a fix before the problem was scoped.');
    }
    if (topics.size < 3) {
      return partly(evidenceFrom(questions), 'Asked about too few areas to see a pattern.');
    }
    return shown(evidenceFrom(questions));
  },
};

const scoping: BehaviourSpec = {
  id: 'resourceful.scoping',
  principle: 'resourceful',
  label: () => 'Scoped who and what was affected',
  done: () => 'scoped who and what was affected',
  missing: () => 'never scoped who or what was affected',
  judge(ctx) {
    const a = analyses(ctx);
    const scope = askedAbout(a, 'affected_scope');
    const detail = askedAbout(
      a,
      'problem_description',
      'error_message',
      'reproducibility',
      'timing_onset',
    );
    if (scope.length > 0 && detail.length > 0) {
      return shown(evidenceFrom([...scope.slice(0, 1), ...detail.slice(0, 1)]));
    }
    if (scope.length > 0) {
      return partly(evidenceFrom(scope, 1), 'Asked who is affected but not what exactly happens.');
    }
    if (detail.length > 0) {
      return partly(
        evidenceFrom(detail, 1),
        'Asked what happens but not who or what else is affected.',
      );
    }
    return absent('Never asked who or what was affected.');
  },
};

const impact: BehaviourSpec = {
  id: 'resourceful.impact',
  principle: 'resourceful',
  label: () => 'Asked about the business impact',
  done: () => 'asked about the business impact',
  missing: () => 'never asked what the problem was costing the customer',
  judge(ctx) {
    const found = askedAbout(analyses(ctx), 'business_impact', 'urgency_deadline');
    return found.length > 0
      ? shown(evidenceFrom(found))
      : absent('Never asked what the problem was costing the customer.');
  },
};

const environment: BehaviourSpec = {
  id: 'resourceful.environment',
  principle: 'resourceful',
  label: () => 'Asked about the environment',
  done: () => 'asked about the environment',
  missing: () => 'never asked about the environment',
  judge(ctx) {
    const found = askedAbout(analyses(ctx), 'environment', 'account_details');
    return found.length > 0
      ? shown(evidenceFrom(found))
      : absent('Never asked about the device, app, account or network involved.');
  },
};

const recentChanges: BehaviourSpec = {
  id: 'resourceful.recent-changes',
  principle: 'resourceful',
  label: () => 'Asked what had changed recently',
  done: () => 'asked what had changed recently',
  missing: () => 'never asked what had changed',
  judge(ctx) {
    const a = analyses(ctx);
    const changed = askedAbout(a, 'recent_changes');
    if (changed.length > 0) return shown(evidenceFrom(changed));
    const when = askedAbout(a, 'timing_onset');
    if (when.length > 0) {
      return partly(evidenceFrom(when, 1), 'Asked when it started but not what had changed.');
    }
    return absent('Never asked what had changed before it started.');
  },
};

const priorTroubleshooting: BehaviourSpec = {
  id: 'resourceful.prior-troubleshooting',
  principle: 'resourceful',
  label: () => 'Asked what had already been tried',
  done: () => 'asked what had already been tried',
  missing: () => 'never asked what had already been tried',
  judge(ctx) {
    const found = askedAbout(analyses(ctx), 'already_tried');
    return found.length > 0
      ? shown(evidenceFrom(found))
      : absent('Never asked what the customer had already tried.');
  },
};

const knownEvidence: BehaviourSpec = {
  id: 'resourceful.known-evidence',
  principle: 'resourceful',
  label: (ctx) =>
    ctx.stage === 'follow-up' || ctx.stage === 'escalated'
      ? 'Showed awareness of the case history'
      : 'Used what the customer had already said',
  done: (ctx) =>
    ctx.stage === 'follow-up' || ctx.stage === 'escalated'
      ? 'showed awareness of the case history'
      : 'built on what the customer had already said',
  missing: (ctx) =>
    ctx.stage === 'follow-up' || ctx.stage === 'escalated'
      ? 'showed no awareness of the case history'
      : 'did not build on what the customer had said',
  judge(ctx) {
    if (ctx.stage === 'follow-up' || ctx.stage === 'escalated') {
      const aware = [
        ...hits(ctx, (s) => HISTORY.test(s.lower)),
        ...askedAbout(analyses(ctx), 'previous_contact'),
      ];
      return aware.length > 0
        ? shown(evidenceFrom(aware))
        : absent('Showed no awareness of what was already on the case.');
    }
    // A sentence that asks or acts on something the customer already told you shows that it was kept.
    const built = hits(ctx, (s, view) => {
      const acts =
        s.question ||
        FIRST_PERSON_COMMIT.test(s.lower) ||
        WE_COMMIT.test(s.lower) ||
        /^please\b/.test(s.lower);
      return acts && overlap(contentWords(s.text), view.customerSoFar) >= 2;
    });
    return built.length > 0
      ? shown(evidenceFrom(built))
      : absent('Nothing the customer had already said was built on.');
  },
};

const escalation: BehaviourSpec = {
  id: 'resourceful.escalation',
  principle: 'resourceful',
  label: (ctx) =>
    ctx.stage === 'escalated' ? 'Explained the escalation' : 'Brought in help when it was needed',
  done: (ctx) =>
    ctx.stage === 'escalated' ? 'explained the escalation' : 'brought in help when it was needed',
  missing: (ctx) =>
    ctx.stage === 'escalated'
      ? 'did not explain the escalation'
      : 'did not bring in help when it was needed',
  judge(ctx) {
    const warranted =
      ctx.stage === 'escalated' ||
      ctx.curveball.type === 'ask-manager' ||
      ctx.customer.some((c) => CUSTOMER_WANTS_ESCALATION.test(norm(c.text)));
    const mentions = hits(ctx, (s) => ESCALATION.test(s.lower));
    if (mentions.length === 0) {
      return warranted ? needed(absent('Never explained what escalating would do.')) : null;
    }
    const explained = mentions.filter((h) => {
      const i = h.view.sentences.indexOf(h.sentence);
      const next = h.view.sentences[i + 1];
      return (
        ESCALATION_EXPLAINED.test(h.sentence.lower) ||
        (next ? ESCALATION_EXPLAINED.test(next.lower) : false)
      );
    });
    const finding =
      explained.length > 0
        ? shown(evidenceFrom(explained))
        : partly(
            evidenceFrom(mentions, 1),
            'Mentioned escalating but not what it would do or who would pick it up.',
          );
    return warranted ? needed(finding) : finding;
  },
};

const noRepeatQuestions: BehaviourSpec = {
  id: 'resourceful.no-repeat-questions',
  principle: 'resourceful',
  label: () => 'Did not repeat questions',
  done: () => 'did not repeat questions',
  missing: () => 'asked something the customer had already answered',
  judge(ctx) {
    const again = repeatEvidence(ctx);
    if (again.length > 0) {
      return harmful(again, 'Asked again about something the customer had already answered.');
    }
    const asked = firstPerTurn(analyses(ctx).intents);
    return asked.length >= 3 ? shown(evidenceFrom(asked, 1)) : null;
  },
};

export const RESOURCEFUL: BehaviourSpec[] = [
  logicalInvestigation,
  scoping,
  impact,
  environment,
  recentChanges,
  priorTroubleshooting,
  knownEvidence,
  escalation,
  noRepeatQuestions,
];
