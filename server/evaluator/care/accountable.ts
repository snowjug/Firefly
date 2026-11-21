import type { Evidence } from '#shared/domain/report.ts';
import { norm } from './lexicon.ts';
import {
  evidenceFrom,
  firstTurns,
  hits,
  pushEvidence,
  recordedEvidence,
  type Hit,
} from './context.ts';
import { absent, harmful, partly, shown, wordCount } from './helpers.ts';
import {
  COMMITMENT_BACK,
  EXPECTATION,
  HISTORY,
  introSignals,
  PROGRESS,
  REALISTIC_PROMISE,
  TIME_REF,
} from './lexicon.ts';
import { analyses } from './moments.ts';
import type { BehaviourSpec } from './types.ts';
import { blameEvidence, promiseEvidence } from './violations.ts';

// ACCOUNTABLE: clear ownership, honest expectations, no blame, no unsupported promises, an explicit
// next action, a named owner, a next-update time, commitments tracked and progress reported.

const ownership: BehaviourSpec = {
  id: 'accountable.ownership',
  principle: 'accountable',
  label: () => 'Took clear ownership',
  done: () => 'took clear ownership',
  missing: () => 'never committed to owning it yourself',
  judge(ctx) {
    const { ownership: moments } = analyses(ctx);
    const clear = moments.filter((m) => m.kind === 'clear');
    if (clear.length > 0) return shown(evidenceFrom(clear.map((m) => m.hit)));
    // "I will look into it" commits to an action but not to seeing the problem through.
    const some = moments.filter((m) => m.kind === 'partly');
    if (some.length > 0) {
      return partly(
        evidenceFrom(some.map((m) => m.hit)),
        'A commitment to do something, but not to see the whole problem through.',
      );
    }
    // "Someone will look at it" is not ownership: nobody in particular has taken it on.
    const elsewhere = moments.filter((m) => m.kind === 'third-party');
    if (elsewhere.length > 0) {
      return absent(
        'Said someone else would look at it instead of committing to act yourself.',
        evidenceFrom(
          elsewhere.map((m) => m.hit),
          1,
        ),
      );
    }
    const vague = ctx.turns.find((v) => v.turn.cls.ownership === 'vague');
    if (vague) {
      const quote = recordedEvidence(vague, 'ownership-vague');
      return absent('Ownership stayed vague.', quote ? [quote] : []);
    }
    return absent('Never said you would take the problem on.');
  },
};

const expectations: BehaviourSpec = {
  id: 'accountable.expectations',
  principle: 'accountable',
  label: () => 'Set honest expectations',
  done: () => 'set honest expectations',
  missing: () => 'did not say what the customer should expect',
  judge(ctx) {
    const over = promiseEvidence(ctx);
    if (over.length > 0) {
      return harmful(
        over,
        'Promised an outcome or a time that nobody could know yet.',
        'promised an outcome that could not be verified',
      );
    }
    const honest = hits(
      ctx,
      (s) => !s.question && (EXPECTATION.test(s.lower) || REALISTIC_PROMISE.test(s.lower)),
    );
    const evidence = evidenceFrom(honest);
    for (const view of ctx.turns) {
      if (view.turn.cls.promise === 'realistic') {
        pushEvidence(evidence, recordedEvidence(view, 'promise-realistic'));
      }
    }
    if (evidence.length > 0) return shown(evidence);
    const timed = analyses(ctx).commitments.filter((c) => c.timed);
    if (timed.length > 0) {
      return partly(
        evidenceFrom(timed.map((c) => c.hit)),
        'Gave a time, but never said what was still uncertain.',
      );
    }
    return absent('Never said what the customer should expect to happen next.');
  },
};

const noBlame: BehaviourSpec = {
  id: 'accountable.no-blame',
  principle: 'accountable',
  label: () => 'Avoided blaming the customer',
  done: () => 'kept blame out of the call',
  missing: () => 'blamed the customer',
  judge(ctx) {
    const blamed = blameEvidence(ctx);
    if (blamed.length > 0) {
      return harmful(
        blamed,
        'Told the customer what they should have done, or whose fault it was.',
      );
    }
    if (ctx.turns.length < 3) return null;
    // Nothing to quote for an absence: the moment where the trainee took the problem on does.
    const { ownership: owning } = analyses(ctx);
    const own = owning.filter((m) => m.kind !== 'third-party');
    return own.length > 0
      ? shown(
          evidenceFrom(
            own.map((m) => m.hit),
            1,
          ),
        )
      : null;
  },
};

const noUnsupportedPromise: BehaviourSpec = {
  id: 'accountable.no-unsupported-promise',
  principle: 'accountable',
  label: () => 'Avoided promises that could not be kept',
  done: () => 'promised only what could be kept',
  missing: () => 'promised an outcome that could not be verified',
  judge(ctx) {
    const over = promiseEvidence(ctx);
    if (over.length > 0) {
      return harmful(over, 'Promised an outcome or a time that nobody could know yet.');
    }
    const honest = hits(ctx, (s) => !s.question && REALISTIC_PROMISE.test(s.lower));
    if (honest.length > 0) return shown(evidenceFrom(honest, 1));
    const { commitments } = analyses(ctx);
    const kept = commitments.filter((c) => (c.self || c.we) && !c.hedged);
    return kept.length > 0
      ? shown(
          evidenceFrom(
            kept.map((c) => c.hit),
            1,
          ),
        )
      : null;
  },
};

const nextAction: BehaviourSpec = {
  id: 'accountable.next-action',
  principle: 'accountable',
  label: () => 'Named an explicit next action',
  done: () => 'named a next action',
  missing: () => 'named no clear next action',
  judge(ctx) {
    const { commitments, ownership: moments } = analyses(ctx);
    const explicit = commitments.filter(
      (c) => (c.self || c.we) && (c.action || c.outcome) && !c.hedged,
    );
    const evidence = evidenceFrom(explicit.map((c) => c.hit));
    // An instruction the customer is asked to follow is also an explicit next action.
    for (const view of ctx.turns) {
      if (view.turn.cls.troubleshooting) {
        pushEvidence(evidence, recordedEvidence(view, 'troubleshooting'));
      }
    }
    if (evidence.length > 0) return shown(evidence.sort((a, b) => a.turnIndex - b.turnIndex));
    const weak = [
      ...commitments.filter((c) => c.hedged || c.update).map((c) => c.hit),
      ...moments.filter((m) => m.kind === 'third-party').map((m) => m.hit),
    ];
    if (weak.length > 0) {
      return partly(evidenceFrom(weak, 1), 'The next step was hedged or left to someone else.');
    }
    return absent('No clear next action was named.');
  },
};

// Saying who owns it, by name or by role.
const OWNER_STATEMENT =
  /\b(?:point of contact|case owner|owner of (?:this|your|the)|i(?:'ll| will) be (?:your|the) (?:single |main |direct )?(?:point of contact|contact|owner|engineer|person)|you can (?:reach|contact|ask for) me|ask for me|i'?m (?:your|the) (?:owner|engineer|contact))\b/;
const NAMED_THIRD =
  /\b[\p{Lu}][\p{L}'-]+ (?:from|on|in|at) (?:the )?[\p{L}0-9 ]{2,30}(?:team|desk|group|department)\b[^.?!]{0,25}\b(?:will|is going to|'ll)\b/u;

const namedOwner: BehaviourSpec = {
  id: 'accountable.named-owner',
  principle: 'accountable',
  label: () => 'Said who owns the next step',
  done: () => 'said who owns the next step',
  missing: () => 'did not say who owns the next step',
  judge(ctx) {
    const stated = hits(
      ctx,
      (s) => !s.question && (OWNER_STATEMENT.test(s.lower) || NAMED_THIRD.test(s.text)),
    );
    if (stated.length > 0) return shown(evidenceFrom(stated));
    const { ownership: moments } = analyses(ctx);
    const owns = moments.filter((m) => m.kind !== 'third-party');
    const introduced = hits(
      ctx,
      (s) => {
        const i = introSignals(s.text);
        return i.lead && i.name;
      },
      firstTurns(ctx, 3),
    );
    if (owns.length > 0 && introduced.length > 0) {
      const evidence: Evidence[] = evidenceFrom(introduced, 1);
      for (const m of owns) pushEvidence(evidence, evidenceFrom([m.hit], 1)[0] ?? null);
      return shown(evidence.sort((a, b) => a.turnIndex - b.turnIndex));
    }
    if (owns.length > 0) {
      return partly(
        evidenceFrom(
          owns.map((m) => m.hit),
          1,
        ),
        'Took it on, but never gave a name the customer could ask for.',
      );
    }
    return absent('Never said who owns the next step.');
  },
};

const updateTime: BehaviourSpec = {
  id: 'accountable.update-time',
  principle: 'accountable',
  label: (ctx) =>
    ctx.stage === 'escalated' ? 'Set a specific update cadence' : 'Gave a time for the next update',
  done: (ctx) =>
    ctx.stage === 'escalated' ? 'set a specific update cadence' : 'gave a time for the next update',
  missing: (ctx) =>
    ctx.stage === 'escalated' ? 'set no update cadence' : 'gave no time for the next update',
  judge(ctx) {
    const { commitments } = analyses(ctx);
    const updates = commitments.filter((c) => c.update);
    const timed = updates.filter((c) => c.timed);
    // The classifier can call "I'll send you the next update" specific. A named time needs a time.
    const evidence: Hit[] = timed.map((c) => c.hit);
    if (ctx.stage === 'escalated') {
      const regular = timed.filter((c) => c.cadence);
      if (regular.length > 0) return shown(evidenceFrom(regular.map((c) => c.hit)));
      if (timed.length > 0) {
        return partly(
          evidenceFrom(evidence),
          'Gave a time, but an escalated case needs a regular cadence.',
        );
      }
    } else if (timed.length > 0) {
      return shown(evidenceFrom(evidence));
    }
    // A model may recognise a time in words the patterns do not.
    for (const view of ctx.turns) {
      const recorded = recordedEvidence(view, 'next-contact', 'next-steps-specific');
      const c = view.turn.cls;
      if (!(c.confirmsNextContact || c.nextSteps === 'specific') || !recorded) continue;
      if (TIME_REF.test(norm(recorded.quote)) && ctx.stage !== 'escalated')
        return shown([recorded]);
    }
    const vague = updates.filter((c) => !c.timed);
    if (vague.length > 0) {
      return partly(
        evidenceFrom(
          vague.map((c) => c.hit),
          1,
        ),
        'Promised an update but gave no time.',
      );
    }
    return absent(
      ctx.stage === 'escalated'
        ? 'No update cadence was set.'
        : 'No time was given for the next update.',
    );
  },
};

const trackCommitments: BehaviourSpec = {
  id: 'accountable.tracks-commitments',
  principle: 'accountable',
  label: () => 'Tracked what each side would do',
  done: () => 'tracked who does what',
  missing: () => 'never tracked who does what',
  judge(ctx) {
    const { summaries, commitments } = analyses(ctx);
    const recaps = summaries.filter(
      (s) =>
        s.commitments >= 2 || (s.commitments >= 1 && TIME_REF.test(norm(s.hit.view.turn.text))),
    );
    if (recaps.length > 0)
      return shown(
        evidenceFrom(
          recaps.map((s) => s.hit),
          1,
        ),
      );
    const back = hits(ctx, (s) => !s.question && COMMITMENT_BACK.test(s.lower));
    if (back.length > 0) return shown(evidenceFrom(back));
    if (summaries.some((s) => s.commitments >= 1)) {
      return partly(
        evidenceFrom(
          summaries.filter((s) => s.commitments >= 1).map((s) => s.hit),
          1,
        ),
        'The recap covered only one side of who does what.',
      );
    }
    const mine = commitments.filter((c) => c.self || c.we);
    if (mine.length >= 2) {
      return partly(
        evidenceFrom(mine.map((c) => c.hit)),
        'Made commitments but never recapped who does what, and by when.',
      );
    }
    return absent('Never pulled together who would do what, and by when.');
  },
};

const progressUpdate: BehaviourSpec = {
  id: 'accountable.progress-update',
  principle: 'accountable',
  label: () => 'Gave a progress update on the case',
  done: () => 'gave a progress update',
  missing: () => 'gave no progress update',
  judge(ctx) {
    const found = hits(ctx, (s) => !s.question && PROGRESS.test(s.lower) && wordCount(s.text) >= 6);
    if (found.length > 0) return shown(evidenceFrom(found));
    const history = hits(ctx, (s) => !s.question && HISTORY.test(s.lower));
    if (history.length > 0) {
      return partly(
        evidenceFrom(history, 1),
        'Referred to the case history but did not say what had happened since.',
      );
    }
    return absent('Gave no update on what had happened with the case.');
  },
};

export const ACCOUNTABLE: BehaviourSpec[] = [
  ownership,
  expectations,
  noBlame,
  noUnsupportedPromise,
  nextAction,
  namedOwner,
  updateTime,
  trackCommitments,
  progressUpdate,
];
