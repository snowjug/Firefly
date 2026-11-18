import type { CommunicationStyle } from '#shared/domain/vocab.ts';
import type { HiddenFact } from '#shared/domain/scenario.ts';
import { unlockedKnownFacts, type TellItem, type WithholdReason } from '../engine/discovery.ts';
import type { CustomerGenerationContext } from '../engine/pipeline.ts';
import { firstSentenceOf } from '../engine/textutil.ts';

// Which facts a customer request may contain, and how to check that a reply stays inside them.
//
// The rule: a hidden fact the trainee has not earned must not appear anywhere in a request: not its
// statement, label, id or hint, and not as a "do not mention" list. The prompt builder reads hidden
// facts only through `sayableThisTurn` and `alreadyShared`, so nothing else about them is in reach.
//
// `factPolicy` is the second line of defence. Scenario notes can restate a hidden fact (a setup
// detail that gives the cause away, for example), and a model can still guess. The policy screens
// such lines before they are sent and checks the reply for details that only an unearned fact holds.

export function isSilent(ctx: CustomerGenerationContext): boolean {
  return ctx.curveball.fired?.type === 'go-silent' || ctx.runtime.customer.silentUntilEngaged;
}

export interface Sayable {
  kind: 'full' | 'partial' | 'known' | 'hint';
  text: string;
  /** Optional extra colour for a talkative customer. */
  colour?: string;
}

function fullStatement(fact: HiddenFact, style: CommunicationStyle): string {
  if (style === 'terse') return fact.statementTerse ?? firstSentenceOf(fact.statement);
  if (style === 'non-native') return fact.statementSimple ?? fact.statement;
  return fact.statement;
}

function knownText(item: TellItem, style: CommunicationStyle): { text: string; colour?: string } {
  if (style === 'terse') return { text: firstSentenceOf(item.text) };
  if (style === 'non-native') return { text: item.simple ?? item.text };
  if (style === 'talkative' && item.elaboration) {
    return { text: item.text, colour: item.elaboration };
  }
  return { text: item.text };
}

/** The only facts the customer may state in this reply: what the engine decided to reveal or tell. */
export function sayableThisTurn(ctx: CustomerGenerationContext): Sayable[] {
  if (isSilent(ctx) || ctx.classification.injectionAttempt) return [];
  const style = ctx.scenario.config.style;
  const items: Sayable[] = [];
  for (const { fact, mode } of ctx.discovery.reveal) {
    if (mode === 'full') items.push({ kind: 'full', text: fullStatement(fact, style) });
    else if (fact.partialStatement) items.push({ kind: 'partial', text: fact.partialStatement });
  }
  for (const item of ctx.discovery.tell) {
    if (!item.repeat) items.push({ kind: 'known', ...knownText(item, style) });
  }
  for (const fact of ctx.discovery.hints) {
    if (fact.hint) items.push({ kind: 'hint', text: fact.hint });
  }
  return items;
}

// Mirrors the text that discovery.ts uses when the trainee asks about earlier contact.
function historyText(ctx: CustomerGenerationContext): string {
  const { scenario } = ctx;
  return scenario.config.callStage === 'first-contact' || !scenario.stageFrame.opening
    ? "No, this is the first time I'm calling about it."
    : scenario.stageFrame.opening;
}

function toldText(ctx: CustomerGenerationContext, id: string): string | null {
  const { scenario, runtime } = ctx;
  if (id === 'impact-detail') return scenario.impactVariant.detail;
  if (id === 'impact-deadline')
    return scenario.impactVariant.deadline ?? scenario.impactVariant.detail;
  if (id === 'history') return historyText(ctx);
  if (id.startsWith('assumption-')) {
    return (
      scenario.incorrectAssumptions.find((a) => `assumption-${a.id}` === id)?.statement ?? null
    );
  }
  const known = [...scenario.knownFacts, ...unlockedKnownFacts(scenario, runtime)];
  return known.find((f) => f.id === id)?.text ?? null;
}

/** What the customer has already said in earlier turns, for consistency. */
export function alreadyShared(ctx: CustomerGenerationContext): string[] {
  const { scenario, runtime, discovery } = ctx;
  const thisTurn = new Set(discovery.reveal.map((r) => r.fact.id));
  const earlier = scenario.hiddenFacts
    .map((fact) => ({ fact, record: runtime.discovery[fact.id] }))
    .filter(({ fact, record }) => record !== undefined && !thisTurn.has(fact.id))
    .sort((a, b) => (a.record?.turnIndex ?? 0) - (b.record?.turnIndex ?? 0));
  const lines: string[] = [];
  for (const { fact, record } of earlier) {
    // A partial reveal shares only the partial statement; the full statement stays out of reach.
    if (record?.status === 'discovered') lines.push(fact.statement);
    else if (fact.partialStatement) lines.push(fact.partialStatement);
  }
  for (const [id, times] of Object.entries(runtime.toldKnownFacts)) {
    const text = times > 0 ? toldText(ctx, id) : null;
    if (text) lines.push(text);
  }
  return lines;
}

/** Why the customer is holding something back, without saying what it is. */
export function withheldReasons(ctx: CustomerGenerationContext): WithholdReason[] {
  if (isSilent(ctx) || ctx.classification.injectionAttempt) return [];
  return [...new Set(ctx.discovery.withheld.map((w) => w.reason))];
}

// ---------------------------------------------------------------------------------------
// Distinctive details of a fact: numbers, codes, names and short runs of content words. Matching
// is on lower-cased, lightly stemmed tokens, so "connects" matches "connect".

interface Analysis {
  tokens: Set<string>; // every stemmed token
  phrases: Set<string>; // two or three consecutive content tokens
  words: Set<string>; // content tokens of four or more letters
  singles: Set<string>; // numbers, codes and names
}

const STOP = new Set(
  (
    'a an the and or but nor of to in on at for with by from as into onto over under about above after ' +
    'before between through during without within is are was were be been being am i me my mine we us ' +
    'our ours you your yours he him his she her hers it its they them their theirs this that these those ' +
    'there here who whom whose which what when where why how not no yes so if then than too very just ' +
    'also only even still again already always never ever now up out off down any some each every all ' +
    'both more most many much other such own same can could will would shall should may might must do ' +
    'does did done have has had having get gets got say says said tell told see seen one because while ' +
    'until since though although either neither really quite rather maybe perhaps yet however thing things way lot bit ' +
    'today tonight tomorrow yesterday usually sometimes normally honestly actually basically unfortunately ' +
    'recently currently finally anyway everyone everybody someone anyone nobody people sorry thanks please okay yeah hello ' +
    "i'm i've i'll i'd it's that's there's he's she's we're we've we'll they're they've you're you've you'll " +
    "let's don't doesn't didn't can't couldn't won't wouldn't shouldn't isn't aren't wasn't weren't " +
    "haven't hasn't hadn't"
  ).split(' '),
);

// Small numbers are too common to be distinctive on their own ("one of us", "two offices").
const NUMBER_WORDS = new Set(
  (
    'four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen ' +
    'eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand dozen'
  ).split(' '),
);

const TOKEN = /[a-z0-9]+(?:['_.:-][a-z0-9]+)*/g;
const CLAUSE_BREAK = /[,;!?()\n]+|[.:](?=\s|$)|\s[-\u2013\u2014]+\s/;

function stem(token: string): string {
  let t = token.replace(/'s$/, '');
  if (t.length <= 3 || /\d/.test(t)) return t;
  if (t.endsWith('ies') && t.length > 4) return `${t.slice(0, -3)}y`;
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (t.endsWith(suffix) && !t.endsWith('ss') && t.length - suffix.length >= 3) {
      t = t.slice(0, -suffix.length);
      break;
    }
  }
  return t.replace(/e$/, '');
}

function isSingle(token: string): boolean {
  return (token.length >= 2 && /\d/.test(token)) || token.includes('_') || NUMBER_WORDS.has(token);
}

// Capitalised words inside a sentence are names (people, places, products). A sentence starts with a
// capital anyway, so its first word counts only when the sentence shows it is a name:
// "Jonas Eriksen ...", "Anil from finance ...", "Chloe, in the east office, ...".
const CAPITALISED = /^[A-Z][a-z]{2,}$/;
const NAME_AND_CONNECTIVE = /^[A-Za-z]+,?\s+(?:from|at|who|whose)\b/;
const NAME_AND_APPOSITIVE = /^[A-Za-z]+,\s+(?:in|from|at|who|whose|our|their|the|my|a|an)\b/;

function properNouns(text: string): string[] {
  const names: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const trimmed = sentence.trim();
    const words = trimmed.split(/\s+/).map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, ''));
    for (const word of words.slice(1)) {
      if (CAPITALISED.test(word) && !STOP.has(word.toLowerCase())) names.push(word.toLowerCase());
    }
    const [first = '', second = ''] = words;
    const opensWithName =
      CAPITALISED.test(first) &&
      !STOP.has(first.toLowerCase()) &&
      (CAPITALISED.test(second) ||
        NAME_AND_CONNECTIVE.test(trimmed) ||
        NAME_AND_APPOSITIVE.test(trimmed));
    if (opensWithName) names.push(first.toLowerCase());
  }
  return names;
}

function analyse(text: string): Analysis {
  const out: Analysis = {
    tokens: new Set(),
    phrases: new Set(),
    words: new Set(),
    singles: new Set(),
  };
  for (const clause of text.split(CLAUSE_BREAK)) {
    const run: string[] = [];
    const endRun = () => {
      for (const size of [2, 3]) {
        for (let i = 0; i + size <= run.length; i++)
          out.phrases.add(run.slice(i, i + size).join(' '));
      }
      for (const word of run) if (word.length >= 4) out.words.add(word);
      run.length = 0;
    };
    for (const raw of clause
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .match(TOKEN) ?? []) {
      const token = stem(raw);
      out.tokens.add(token);
      if (isSingle(raw)) out.singles.add(token);
      if (STOP.has(raw)) endRun();
      else run.push(token);
    }
    endRun();
  }
  for (const name of properNouns(text)) out.singles.add(stem(name));
  return out;
}

const isText = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '';

const count = (a: Set<string>, b: Set<string>): number => [...a].filter((x) => b.has(x)).length;

interface FactTerms {
  phrases: Set<string>;
  singles: Set<string>;
  words: Set<string>;
}

/** Details only this fact contains: anything the scenario or conversation already says is exempt. */
function termsOf(fact: HiddenFact, exempt: Analysis): FactTerms {
  const main = [fact.statement, fact.partialStatement].filter(isText).map(analyse);
  const variants = [fact.statementTerse, fact.statementSimple].filter(isText).map(analyse);
  const keep = (source: Set<string>, known: Set<string>) =>
    new Set([...source].filter((term) => !known.has(term)));
  return {
    phrases: keep(new Set(main.flatMap((a) => [...a.phrases])), exempt.phrases),
    // Terse and simple variants add only numbers and names; their short phrases are too generic.
    singles: keep(new Set([...main, ...variants].flatMap((a) => [...a.singles])), exempt.tokens),
    words: keep(new Set(main.flatMap((a) => [...a.words])), exempt.tokens),
  };
}

// Everything the scenario shows the customer, plus the conversation and what may be said this turn.
// Setup notes and earlier case history are left out on purpose: they are what gets screened.
function exemptText(ctx: CustomerGenerationContext): string {
  const s = ctx.scenario;
  const known = (f: { text: string; elaboration?: string; simple?: string }) => [
    f.text,
    f.elaboration ?? '',
    f.simple ?? '',
  ];
  return [
    s.title,
    s.summary,
    s.persona.name,
    s.persona.role,
    s.persona.organisation,
    s.persona.background,
    s.persona.voice,
    s.customerObjective,
    s.openingCore,
    s.stageFrame.opening,
    s.stageFrame.brief,
    s.brief.situation,
    s.brief.goal,
    s.impactVariant.summary,
    s.impactVariant.detail,
    s.impactVariant.deadline ?? '',
    ...s.knownFacts.flatMap(known),
    ...s.incorrectAssumptions.map((a) => a.statement),
    ...s.curveballs.flatMap((c) => [
      c.statement,
      c.followUp ?? '',
      ...(c.introducesFacts ?? []).flatMap(known),
    ]),
    ...ctx.history.map((t) => t.text),
    ctx.traineeText,
    ...sayableThisTurn(ctx).flatMap((item) => [item.text, item.colour ?? '']),
    ...alreadyShared(ctx),
  ].join('\n');
}

export interface FactPolicy {
  /** The reply states a number, code, name or phrase that only an unearned hidden fact contains. */
  leaks(text: string): boolean;
  /** The line is too close to an unearned hidden fact to show the model. */
  restates(text: string): boolean;
}

export function factPolicy(ctx: CustomerGenerationContext): FactPolicy {
  const exempt = analyse(exemptText(ctx));
  const earned = (fact: HiddenFact) =>
    ctx.runtime.discovery[fact.id]?.status === 'discovered' ||
    ctx.discovery.reveal.some((r) => r.fact.id === fact.id && r.mode === 'full');
  const unearned = ctx.scenario.hiddenFacts
    .filter((fact) => !earned(fact))
    .map((f) => termsOf(f, exempt));

  const leaked = (t: FactTerms, a: Analysis) =>
    count(t.phrases, a.phrases) > 0 || count(t.singles, a.tokens) > 0;
  return {
    leaks: (text) => {
      const a = analyse(text);
      return unearned.some((t) => leaked(t, a));
    },
    restates: (text) => {
      const a = analyse(text);
      return unearned.some((t) => leaked(t, a) || count(t.words, a.tokens) >= 2);
    },
  };
}
