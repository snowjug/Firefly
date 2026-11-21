import type { Evidence } from '#shared/domain/report.ts';
import {
  evidenceFrom,
  evidenceOf,
  hits,
  lastTurns,
  pushEvidence,
  recordedEvidence,
  type CareContext,
  type Hit,
} from './context.ts';
import { absent, harmful, partly, shown } from './helpers.ts';
import { ANYTHING_ELSE, contentWords, HISTORY, overlap } from './lexicon.ts';
import { analyses, type Analyses, type EmpathyMoment } from './moments.ts';
import type { BehaviourSpec } from './types.ts';
import { blameEvidence, dismissiveEvidence, impatientEvidence } from './violations.ts';

// EMPATHETIC: acknowledging the concern and the business impact, a respectful tone, de-escalation,
// nothing dismissive, no robotic repeated apology, adapting to how the customer feels.
//
// Empathy is read from what follows it. "I understand" earns credit when it is about something the
// customer actually said, or when an action follows it. Said again and again with nothing behind it,
// it earns none, and the same apology repeated word for word lowers the result.

/** Empathy lines that repeat a stock phrase: identical sentences, the same lead twice with nothing specific, or three bare ones. */
export function repeatedEmpathy(a: Analyses): EmpathyMoment[] {
  const repeated = new Set<EmpathyMoment>();
  const identical = new Map<string, EmpathyMoment[]>();
  for (const m of a.empathy) identical.set(m.folded, [...(identical.get(m.folded) ?? []), m]);
  for (const group of identical.values())
    if (group.length >= 2) group.forEach((m) => repeated.add(m));

  const sameLead = new Map<string, EmpathyMoment[]>();
  for (const m of a.empathy.filter((x) => x.kind !== 'specific')) {
    sameLead.set(m.lead, [...(sameLead.get(m.lead) ?? []), m]);
  }
  for (const group of sameLead.values())
    if (group.length >= 2) group.forEach((m) => repeated.add(m));

  const bare = a.empathy.filter((m) => m.kind === 'bare');
  if (bare.length >= 3) bare.forEach((m) => repeated.add(m));
  return a.empathy.filter((m) => repeated.has(m));
}

const acted = (a: Analyses): boolean =>
  a.ownership.some((m) => m.kind !== 'third-party') || a.commitments.some((c) => c.self || c.we);

const concern: BehaviourSpec = {
  id: 'empathetic.concern',
  principle: 'empathetic',
  label: (ctx) =>
    ctx.stage === 'escalated'
      ? 'Acknowledged the earlier experience'
      : ctx.stage === 'follow-up'
        ? 'Acknowledged the wait and the history'
        : "Acknowledged the customer's concern",
  done: (ctx) =>
    ctx.stage === 'escalated' || ctx.stage === 'follow-up'
      ? 'acknowledged what the customer had been through'
      : `showed empathy that fitted ${ctx.call.name}'s situation`,
  missing: (ctx) =>
    ctx.stage === 'escalated'
      ? 'did not acknowledge the earlier experience'
      : ctx.stage === 'follow-up'
        ? 'did not acknowledge the wait'
        : `did not acknowledge how ${ctx.call.name} felt`,
  judge(ctx) {
    const a = analyses(ctx);
    const specific = a.empathy.filter((m) => m.kind === 'specific');
    const withAction = a.empathy.filter((m) => m.kind === 'with-action');
    const bare = a.empathy.filter((m) => m.kind === 'bare');
    const robotic = repeatedEmpathy(a);
    const hitsOf = (list: EmpathyMoment[]): Hit[] => list.map((m) => m.hit);

    if (specific.length > 0) {
      if (robotic.length > 0) {
        return {
          ...partly(
            evidenceFrom(hitsOf(specific)),
            'Specific once, but the same apology or reassurance was repeated.',
          ),
          harm: true,
        };
      }
      return shown(
        evidenceFrom(hitsOf(specific)),
        acted(a) ? undefined : 'Empathy was not followed by an action.',
      );
    }
    if (withAction.length > 0) {
      const finding = partly(
        evidenceFrom(hitsOf(withAction)),
        'Sympathy came with an action, but never named what the customer was going through.',
      );
      return robotic.length > 0 ? { ...finding, harm: true } : finding;
    }
    if (bare.length > 0) {
      return {
        ...absent(
          robotic.length > 0
            ? 'The same "I understand" or "sorry" was repeated with nothing useful after it.'
            : 'A stock phrase of sympathy with nothing useful after it.',
          evidenceFrom(hitsOf(bare)),
          robotic.length > 0 ? REPEATED_CLAUSE : 'offered only a stock phrase of sympathy',
        ),
        ...(robotic.length > 0 ? { harm: true } : {}),
      };
    }
    return absent(
      ctx.stage === 'escalated'
        ? 'The earlier experience was not acknowledged.'
        : ctx.stage === 'follow-up'
          ? 'The wait and the history were not acknowledged.'
          : acted(a)
            ? 'Moved straight to action without acknowledging how the customer felt.'
            : 'No acknowledgement of how the problem affected the customer.',
    );
  },
};

// Naming the stakes: what is blocked, who is waiting, what is urgent.
const IMPACT_FRAME =
  /\b(?:(?:i|we)(?:'m| am)? (?:(?:fully|completely|really|truly|totally|do|can) )*(?:understand|realise|realize|know|see|appreciate|hear|recognise|recognize|get)\b[^.?!]{0,60}\b(?:urgent\w*|critical|priority|deadline|time[- ]critical|important|affecting|impacting|blocking|waiting|stuck|stakes|pressure|presenting|depend\w*)|(?:affecting|impacting|blocking|holding up|stopping|disrupting) (?:your|the|us)\b|(?:treat|treating|treated) (?:this|it) (?:as )?(?:a |an )?(?:priority|urgent)|(?:this|that|it)(?:'s| is) (?:clearly |obviously )?(?:urgent|critical|a priority|a big deal|serious|important to you)\b|(?:(?:your|the|our) )?(?:team|business|customers|patients|staff|clients|front desk|users|operations)\b[^.?!]{0,30}\b(?:waiting|stuck|blocked|can'?t|cannot|depend|rely|are unable)\b|every (?:minute|hour|second) (?:counts|matters))\b/;

const businessImpact: BehaviourSpec = {
  id: 'empathetic.business-impact',
  principle: 'empathetic',
  label: () => 'Acknowledged the business impact',
  done: (ctx) => `acknowledged what this meant for ${ctx.call.name}`,
  missing: () => 'never acknowledged the business impact',
  judge(ctx) {
    const found: { evidence: Evidence; specific: boolean }[] = [];
    const isSpecific = (text: string, view: Hit['view']): boolean => {
      const words = contentWords(text);
      return (
        overlap(words, view.previousCustomer) >= 1 ||
        overlap(words, view.customerSoFar) >= 1 ||
        overlap(words, ctx.situation) >= 2
      );
    };
    const heard = new Set<Hit['view']>();
    for (const hit of hits(ctx, (s) => !s.question && IMPACT_FRAME.test(s.lower))) {
      const evidence = evidenceOf(hit);
      if (!evidence) continue;
      heard.add(hit.view);
      found.push({ evidence, specific: isSpecific(hit.sentence.text, hit.view) });
    }
    // The classification may have heard an acknowledgement that the patterns do not know.
    for (const view of ctx.turns) {
      if (!view.turn.cls.acknowledgesImpact || heard.has(view)) continue;
      const evidence = recordedEvidence(view, 'impact-acknowledged');
      if (evidence) found.push({ evidence, specific: isSpecific(evidence.quote, view) });
    }
    const pick = (list: typeof found): Evidence[] => {
      const out: Evidence[] = [];
      for (const f of list) pushEvidence(out, f.evidence);
      return out.sort((x, y) => x.turnIndex - y.turnIndex);
    };
    const specific = pick(found.filter((f) => f.specific));
    if (specific.length > 0) return shown(specific);
    if (found.length > 0) {
      return partly(
        pick(found).slice(0, 1),
        'Said it mattered, but did not name what was at stake.',
      );
    }
    return absent("Never acknowledged what this meant for the customer's business.");
  },
};

const COURTESY =
  /\b(?:thanks?|thank you|please|appreciate|pleasure|welcome|sorry|apologi[sz]e|hello|good (?:morning|afternoon|evening))\b/;

const respectfulTone: BehaviourSpec = {
  id: 'empathetic.respectful-tone',
  principle: 'empathetic',
  label: () => 'Kept a respectful tone',
  done: () => 'kept a respectful tone',
  missing: () => 'let blame, dismissal or impatience into the call',
  judge(ctx) {
    const rude = [
      ...blameEvidence(ctx),
      ...dismissiveEvidence(ctx),
      ...impatientEvidence(ctx),
    ].sort((x, y) => x.turnIndex - y.turnIndex);
    if (rude.length > 0) {
      const unique = rude.filter(
        (e, i) => rude.findIndex((o) => o.turnIndex === e.turnIndex) === i,
      );
      return harmful(unique.slice(0, 2), 'Blame, dismissal or impatience crept into the call.');
    }
    if (ctx.turns.length < 3) return null;
    // Courtesy is shown by what was said, not required in particular words: it is only quoted when
    // it is there, and its absence is never marked down.
    const polite = evidenceFrom(
      hits(ctx, (s) => COURTESY.test(s.lower)),
      1,
    );
    return polite.length > 0 ? shown(polite) : null;
  },
};

function calming(ctx: CareContext, a: Analyses, turnIndex: number): Evidence | null {
  const view = ctx.turns.find((v) => v.turn.index === turnIndex);
  if (!view) return null;
  const heard = acknowledging(ctx, a, turnIndex);
  if (heard) return heard;
  const c = view.turn.cls;
  if (c.ownership === 'clear') return recordedEvidence(view, 'ownership-clear');
  if (c.nextSteps === 'specific') return recordedEvidence(view, 'next-steps-specific');
  if (c.promise === 'realistic') return recordedEvidence(view, 'promise-realistic');
  return null;
}

/** The trainee's reply recognised how the customer felt, rather than carrying on regardless. */
function acknowledging(ctx: CareContext, a: Analyses, turnIndex: number): Evidence | null {
  const view = ctx.turns.find((v) => v.turn.index === turnIndex);
  if (!view) return null;
  const mine = a.empathy.filter((m) => m.hit.view === view && m.kind !== 'bare');
  if (mine.length > 0) return evidenceOf(mine[0]?.hit as Hit);
  if (view.turn.cls.acknowledgesImpact) return recordedEvidence(view, 'impact-acknowledged');
  const history = hits(ctx, (s) => HISTORY.test(s.lower), [view]);
  return ctx.stage === 'follow-up' || ctx.stage === 'escalated'
    ? (evidenceFrom(history, 1)[0] ?? null)
    : null;
}

/** The customer was already frustrated or worse when the trainee replied. */
const UPSET_FROM = 41;

const deEscalation: BehaviourSpec = {
  id: 'empathetic.de-escalation',
  principle: 'empathetic',
  label: () => 'Calmed the situation',
  done: (ctx) => `calmed ${ctx.call.name}`,
  missing: (ctx) => `did not calm ${ctx.call.name}`,
  judge(ctx) {
    const hot = ctx.rows.filter((r) => r.before >= UPSET_FROM);
    if (hot.length === 0) return null; // nothing to calm
    const a = analyses(ctx);
    const calmed: { evidence: Evidence; eased: boolean }[] = [];
    for (const row of hot) {
      const evidence = calming(ctx, a, row.turn.index);
      if (evidence) calmed.push({ evidence, eased: row.after <= row.before - 4 });
    }
    const start = (hot[0] as (typeof hot)[number]).before;
    const end = ctx.rows[ctx.rows.length - 1]?.after ?? start;
    const worked = calmed.filter((c) => c.eased);
    if (worked.length > 0 && (end <= start - 8 || worked.length >= 2)) {
      return shown(worked.slice(0, 2).map((c) => c.evidence));
    }
    if (calmed.length > 0) {
      return partly(
        calmed.slice(0, 2).map((c) => c.evidence),
        worked.length > 0
          ? 'The customer eased a little but stayed unsettled.'
          : 'Tried to calm the customer, but they stayed unsettled.',
      );
    }
    return absent('The customer was upset and no reply acknowledged it.');
  },
};

const noDismissive: BehaviourSpec = {
  id: 'empathetic.no-dismissive',
  principle: 'empathetic',
  label: () => 'Avoided dismissive wording',
  done: () => 'never played the concern down',
  missing: () => 'played down the customer’s concern',
  judge(ctx) {
    const brushed = dismissiveEvidence(ctx);
    if (brushed.length > 0) {
      return harmful(
        brushed,
        "Played down the customer's concern or told them not to worry about it.",
      );
    }
    if (ctx.turns.length < 3) return null;
    const a = analyses(ctx);
    const caring = a.empathy.filter((m) => m.kind !== 'bare');
    return caring.length > 0
      ? shown(
          evidenceFrom(
            caring.map((m) => m.hit),
            1,
          ),
        )
      : null;
  },
};

const REPEATED_CLAUSE = 'repeated the same apology or reassurance';

const noRoboticApology: BehaviourSpec = {
  id: 'empathetic.no-robotic-apology',
  principle: 'empathetic',
  label: () => 'Did not repeat the same apology or reassurance',
  done: () => 'kept apologies and reassurance varied',
  missing: () => REPEATED_CLAUSE,
  judge(ctx) {
    const a = analyses(ctx);
    if (a.empathy.length === 0) return null;
    const robotic = repeatedEmpathy(a);
    if (robotic.length > 0) {
      return harmful(
        evidenceFrom(robotic.map((m) => m.hit)),
        'The same stock apology or reassurance came up again, which sounds scripted.',
      );
    }
    const first = a.empathy[0];
    return first ? shown(evidenceFrom([first.hit], 1)) : null;
  },
};

const adapts: BehaviourSpec = {
  id: 'empathetic.adapts',
  principle: 'empathetic',
  label: () => 'Adapted to how the customer felt',
  done: (ctx) => `responded to how ${ctx.call.name} felt`,
  missing: (ctx) => `carried on as normal while ${ctx.call.name} was upset`,
  judge(ctx) {
    const hot = ctx.rows.filter((r) => r.before >= UPSET_FROM);
    if (hot.length === 0) return null;
    const a = analyses(ctx);
    const adapted = hot
      .map((row) => ({ row, evidence: acknowledging(ctx, a, row.turn.index) }))
      .filter((x): x is { row: (typeof hot)[number]; evidence: Evidence } => x.evidence !== null);
    const share = adapted.length / hot.length;
    const evidence = adapted.slice(0, 2).map((x) => x.evidence);
    if (share >= 0.66) return shown(evidence);
    const firstReplied = adapted.some((x) => x.row === hot[0]);
    if (adapted.length > 0 && (share >= 0.34 || firstReplied)) {
      return partly(evidence, 'Responded to the customer’s mood in some replies but not all.');
    }
    return absent('Carried on with questions while the customer was upset.');
  },
};

const remainingConcerns: BehaviourSpec = {
  id: 'empathetic.remaining-concerns',
  principle: 'empathetic',
  label: () => 'Checked for any remaining concerns',
  done: () => 'checked for any remaining concerns',
  missing: () => 'never checked for remaining concerns',
  judge(ctx) {
    const found = hits(ctx, (s) => ANYTHING_ELSE.test(s.lower));
    const lastTwo = new Set(lastTurns(ctx, 2));
    const atEnd = found.filter((h) => lastTwo.has(h.view));
    if (atEnd.length > 0) return shown(evidenceFrom(atEnd, 1));
    if (found.length > 0) {
      return partly(
        evidenceFrom(found, 1),
        'Asked about anything else, but not at the end of the call.',
      );
    }
    return absent('Never asked whether anything was still worrying the customer.');
  },
};

export const EMPATHETIC: BehaviourSpec[] = [
  concern,
  businessImpact,
  respectfulTone,
  deEscalation,
  noDismissive,
  noRoboticApology,
  adapts,
  remainingConcerns,
];
