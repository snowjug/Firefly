import { GENERIC_CURVEBALLS } from '#shared/domain/curveballs.ts';
import { ScenarioDefinitionSchema, type ScenarioDefinition } from '#shared/domain/scenario.ts';
import {
  CALL_STAGES,
  DIFFICULTY_RANK,
  DISCOVERY_INTENTS,
  PRODUCT_INFO,
  type Difficulty,
} from '#shared/domain/vocab.ts';
import azureDeploymentFails from './library/azure-deployment-fails-permissions.ts';
import azureUnexpectedCharges from './library/azure-unexpected-charges.ts';
import azureVmUnreachable from './library/azure-vm-unreachable-production.ts';
import defenderContractHeld from './library/defender-contract-attachment-held-escalated.ts';
import defenderInvoices from './library/defender-invoices-quarantined.ts';
import dynamicsDashboardSlow from './library/dynamics-dashboard-slow-to-load.ts';
import dynamicsRecords from './library/dynamics-records-not-visible-after-role-change.ts';
import entraNewHires from './library/entra-new-hires-blocked-sign-in.ts';
import entraPasswordReset from './library/entra-password-reset-unavailable.ts';
import entraSignInCheck from './library/entra-cannot-complete-sign-in-check.ts';
import exchangeMailDelays from './library/exchange-mail-delays-follow-up.ts';
import exchangePartnerBounced from './library/exchange-partner-email-bounced-follow-up.ts';
import intuneDevices from './library/intune-devices-not-compliant-closure.ts';
import intuneEnrolmentFails from './library/intune-company-portal-enrolment-fails.ts';
import m365AppsExcel from './library/m365-apps-excel-crashes-after-update.ts';
import m365AppsLicence from './library/m365-apps-licence-not-found.ts';
import onedriveCloudIcons from './library/onedrive-files-show-cloud-icons.ts';
import onedriveSync from './library/onedrive-sync-closure.ts';
import outlookDelegateCalendar from './library/outlook-delegate-calendar-closure.ts';
import outlookPasswordPrompts from './library/outlook-keeps-asking-for-password.ts';
import outlookSharedMailbox from './library/outlook-shared-mailbox-missing.ts';
import powerAppsConnection from './library/power-apps-connection-error-follow-up.ts';
import powerAutomate from './library/power-automate-approvals-stopped.ts';
import sharepointAccess from './library/sharepoint-site-access-escalated.ts';
import sharepointSharedLink from './library/sharepoint-shared-link-not-opening.ts';
import teamsChoppyAudio from './library/teams-choppy-audio-on-calls.ts';
import teamsExternalMeetings from './library/teams-cannot-join-external-meetings.ts';
import teamsRecordingMissing from './library/teams-meeting-recording-missing-follow-up.ts';
import windowsBitlocker from './library/windows-bitlocker-recovery-prompt.ts';
import windowsSlow from './library/windows-11-slow-after-update.ts';
import windowsWifiDrops from './library/windows-wifi-keeps-dropping.ts';
import wordDuplicateCopies from './library/word-document-duplicate-copies-escalated.ts';

// Registry of the built-in synthetic Microsoft support scenarios, easiest first. Add a scenario by
// creating a file in ./library and listing it here; `npm run validate:scenarios` checks everything.
// A new scenario goes after the ones already listed for its difficulty: the order here is the order
// of `GET /api/scenarios`, and it breaks the tie when the report suggests what to practise next, so
// the scenarios that are listed already keep their place. The scenarios page sorts its own cards.
const LIBRARY_INPUT: unknown[] = [
  // Starter
  outlookSharedMailbox,
  onedriveSync,
  powerAutomate,
  windowsSlow,
  teamsChoppyAudio,
  sharepointSharedLink,
  onedriveCloudIcons,
  entraPasswordReset,
  intuneEnrolmentFails,
  windowsWifiDrops,
  dynamicsDashboardSlow,
  // Standard
  teamsExternalMeetings,
  exchangeMailDelays,
  m365AppsExcel,
  intuneDevices,
  defenderInvoices,
  windowsBitlocker,
  azureUnexpectedCharges,
  dynamicsRecords,
  teamsRecordingMissing,
  outlookPasswordPrompts,
  outlookDelegateCalendar,
  m365AppsLicence,
  powerAppsConnection,
  // Challenge
  sharepointAccess,
  entraNewHires,
  azureVmUnreachable,
  azureDeploymentFails,
  exchangePartnerBounced,
  entraSignInCheck,
  defenderContractHeld,
  wordDuplicateCopies,
];

export interface LoadedScenarios {
  scenarios: ScenarioDefinition[];
  errors: string[];
}

export function loadScenarios(input: unknown[] = LIBRARY_INPUT): LoadedScenarios {
  const scenarios: ScenarioDefinition[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const personas = new Map<string, string>();
  const shortTitles = new Map<string, string>();
  for (const raw of input) {
    const parsed = ScenarioDefinitionSchema.safeParse(raw);
    if (!parsed.success) {
      const id =
        typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : '?';
      for (const issue of parsed.error.issues) {
        errors.push(`${id}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    if (seen.has(parsed.data.id)) {
      errors.push(`${parsed.data.id}: duplicate scenario id`);
      continue;
    }
    seen.add(parsed.data.id);
    // Distinct customer names keep scenarios recognisable in history, reports and demos.
    const personaKey = parsed.data.persona.name.trim().toLowerCase();
    const sameName = personas.get(personaKey);
    if (sameName) {
      errors.push(
        `${parsed.data.id}: persona name "${parsed.data.persona.name}" is already used by ${sameName}`,
      );
    } else {
      personas.set(personaKey, parsed.data.id);
    }
    // Two cards with the same short title could not be told apart.
    const shortKey = parsed.data.shortTitle.trim().toLowerCase();
    const sameShort = shortTitles.get(shortKey);
    if (sameShort) {
      errors.push(
        `${parsed.data.id}: shortTitle "${parsed.data.shortTitle}" is already used by ${sameShort}`,
      );
    } else {
      shortTitles.set(shortKey, parsed.data.id);
    }
    errors.push(...semanticIssues(parsed.data));
    scenarios.push(parsed.data);
  }
  return { scenarios, errors };
}

// Distinctive tokens (numbers, codes, product error ids) of a hidden fact must not appear in text
// that the customer shares before the fact is discovered.
export function distinctiveTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const m of text.matchAll(
    /\b[A-Z]{2,}[A-Z0-9_-]*\d+[A-Z0-9_-]*\b|\b\d[\d,.:%]*\d\b|\b0x[0-9A-Fa-f]+\b/g,
  )) {
    tokens.add(m[0].toLowerCase());
  }
  return [...tokens];
}

const PRODUCT_CLAIM_PATTERNS: [string, RegExp][] = [
  ['a KB article number', /\bKB\s?\d{5,}\b/i],
  ['a hexadecimal error code', /\b0x[0-9a-f]{4,}\b/i],
  ['an error code', /\b[A-Z]{3,}[A-Z0-9_-]*\d{3,}[A-Z0-9_-]*\b/],
  ['a web address', /\bhttps?:\/\/|\bwww\.\S+/i],
  ['an email address', /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/],
  ['a phone number', /\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]\d{3,4}[\s-]\d{3,4}\b/],
  ['an IP address', /\b\d{1,3}(?:\.\d{1,3}){3}\b/],
  ['a GUID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  [
    'a command or cmdlet',
    /\b(?:Get|Set|New|Remove|Add|Enable|Disable|Connect|Invoke|Test|Start|Stop|Restart)-[A-Z][A-Za-z]+\b/,
  ],
  ['a command', /\b(?:ipconfig|powershell|cmd\.exe|gpupdate|regedit|manage-bde|dism)\b/i],
  ['a version or build number', /\b(?:version|build)\s+\d[\d.]*/i],
  ['a menu path', /\s(?:>|→|›)\s/],
];

// Every piece of text in a scenario, with where it is. Ids and the made-up case number are skipped.
function allText(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => allText(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      k === 'id' || k === 'caseReference' || k === 'intents' || k === 'partialIntents'
        ? []
        : allText(v, path ? `${path}.${k}` : k),
    );
  }
  return [];
}

const STOPWORDS = new Set(
  "a an the i we you it its it's is are was were be been to of in on at for with and or but so that this they them he she my our your their not no do does did have has had can could would will just if as by from up out about i'm we're don't i'd i've there here what when which who how than then also still very really some any all one add new make made get got going need want see say said let take like use used".split(
    ' ',
  ),
);

const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Wording that two texts share, or null. A run of four words counts when it holds at least three
 * content words ("only external meetings are affected"); a run of six counts when it holds at
 * least two. Runs of small words ("i think it was") and short common phrases are ignored.
 */
export function sharedPhrase(source: string, other: string): string | null {
  const a = wordsOf(source);
  const haystack = ` ${wordsOf(other).join(' ')} `;
  for (const [length, content] of [
    [4, 3],
    [6, 2],
  ] as const) {
    for (let i = 0; i + length <= a.length; i++) {
      const run = a.slice(i, i + length);
      if (run.filter((w) => !STOPWORDS.has(w)).length < content) continue;
      if (haystack.includes(` ${run.join(' ')} `)) return run.join(' ');
    }
  }
  return null;
}

// Words that carry no meaning of their own in a title.
const TITLE_FUNCTION_WORDS = new Set(
  'from since after before above below over under into onto near far now again during until'.split(
    ' ',
  ),
);

/** A word cut back to a rough root, so that "approvals" and "approval", or "running" and "run", match. */
function stem(word: string): string {
  let w = word.replace(/'s$/, '');
  if (w === "can't") return 'cannot';
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && /([^aeiou])\1$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

/** The meaningful words of a title, each with its root. */
const contentRoots = (text: string): { word: string; root: string }[] =>
  wordsOf(text)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !TITLE_FUNCTION_WORDS.has(w))
    .map((word) => ({ word, root: stem(word) }));

/**
 * The short title is the title on a scenario card. It is a shorter way to say what the title and
 * the public brief already say, so it is no longer than the title, shares a content word with it
 * and uses no content word that neither the title nor `publicBrief.issue` holds: it can add nothing
 * to what a trainee may read, so it cannot hint at a hidden fact.
 */
function shortTitleIssues(s: ScenarioDefinition): string[] {
  const issues: string[] = [];
  if (s.shortTitle.length > s.title.length) {
    issues.push(`${s.id}: shortTitle is longer than the title`);
  }
  const fromTitle = new Set(contentRoots(s.title).map((w) => w.root));
  const own = contentRoots(s.shortTitle);
  if (!own.some((w) => fromTitle.has(w.root))) {
    issues.push(`${s.id}: shortTitle shares no content word with the title`);
  }
  const known = new Set([...fromTitle, ...contentRoots(s.publicBrief.issue).map((w) => w.root)]);
  const added = own.filter((w) => !known.has(w.root)).map((w) => w.word);
  if (added.length > 0) {
    issues.push(
      `${s.id}: shortTitle adds "${added.join('", "')}", which neither the title nor publicBrief.issue says`,
    );
  }
  return issues;
}

export function semanticIssues(s: ScenarioDefinition): string[] {
  const issues: string[] = [...shortTitleIssues(s)];
  const family = PRODUCT_INFO[s.product.id].family;
  if (s.grounding.productFamily !== family) {
    issues.push(
      `${s.id}: grounding.productFamily "${s.grounding.productFamily}" is not the family of ${s.product.id} ("${family}")`,
    );
  }
  // The public brief is the same at every call stage, so a scenario written for a first contact has
  // no earlier contact to state: it would be shown, and be wrong, if the call were set to a call-back.
  if (s.callStage === 'first-contact' && s.publicBrief.previousContact) {
    issues.push(
      'publicBrief.previousContact: a first-contact scenario has no earlier contact to state (the brief is shown at every call stage)',
    );
  }
  // Everything the customer or the trainee can read before a hidden fact is discovered. A hidden
  // fact has to come out through discovery, so none of its distinctive tokens may appear here.
  const earlyText: [string, string][] = [
    ['title', s.title],
    ['shortTitle', s.shortTitle],
    ['listSummary', s.listSummary],
    ['summary', s.summary],
    ['openingCore', s.openingCore],
    ['brief.situation', s.brief.situation],
    ['brief.goal', s.brief.goal],
    ['publicBrief.issue', s.publicBrief.issue],
    ['publicBrief.objective', s.publicBrief.objective],
    ...(['knownContext', 'previousContact', 'environment'] as const).flatMap(
      (k): [string, string][] => {
        const value = s.publicBrief[k];
        return value ? [[`publicBrief.${k}`, value]] : [];
      },
    ),
    ...(['low', 'medium', 'high'] as const).flatMap((k): [string, string][] => [
      [`publicBrief.impact.${k}`, s.publicBrief.impact[k]],
      [`impactVariants.${k}.summary`, s.impactVariants[k].summary],
    ]),
    ...s.knownFacts.flatMap((f, i): [string, string][] => [
      [`knownFacts[${i}]`, f.text],
      ...(f.elaboration
        ? [[`knownFacts[${i}].elaboration`, f.elaboration] as [string, string]]
        : []),
      ...(f.simple ? [[`knownFacts[${i}].simple`, f.simple] as [string, string]] : []),
    ]),
    ...s.vagueFacts.flatMap((f, i): [string, string][] => [
      [`vagueFacts[${i}]`, f.text],
      ...(f.confirmedText
        ? [[`vagueFacts[${i}].confirmedText`, f.confirmedText] as [string, string]]
        : []),
    ]),
    ...s.checkableFacts.flatMap((f, i): [string, string][] => [
      [`checkableFacts[${i}].checking`, f.checking],
      [`checkableFacts[${i}]`, f.text],
    ]),
    ...s.unknownFacts.map((f, i): [string, string] => [`unknownFacts[${i}]`, f.text]),
    ...s.irrelevantFacts.map((f, i): [string, string] => [`irrelevantFacts[${i}]`, f.text]),
    ...Object.entries(s.stageFrames).flatMap(([k, v]): [string, string][] =>
      v
        ? [
            [`stageFrames.${k}.opening`, v.opening],
            [`stageFrames.${k}.brief`, v.brief],
          ]
        : [],
    ),
    ...s.expectedDiscoveryAreas.map((a, i): [string, string] => [
      `expectedDiscoveryAreas[${i}]`,
      a,
    ]),
    // Trainee-visible case history, and what the customer volunteers or says when asked about impact.
    // (`previousTroubleshooting` and `recentChanges` are the case record: they may hold the truth,
    // including what a hidden fact reveals. The engine withholds any note that restates a hidden
    // fact until that fact has been earned, so they are not checked here.)
    ...s.priorHistory.map((h, i): [string, string] => [`priorHistory[${i}]`, h.summary]),
    ...s.incorrectAssumptions.map((a, i): [string, string] => [
      `incorrectAssumptions[${i}]`,
      a.statement,
    ]),
    ...(['low', 'medium', 'high'] as const).flatMap((k): [string, string][] => {
      const { detail, deadline } = s.impactVariants[k];
      return [
        [`impactVariants.${k}.detail`, detail],
        ...(deadline ? [[`impactVariants.${k}.deadline`, deadline] as [string, string]] : []),
      ];
    }),
  ];
  // Every wording a hidden fact can have, including the versions for other impact levels.
  const statementsOf = (fact: ScenarioDefinition['hiddenFacts'][number]) => {
    const versions = [
      ['', fact],
      ...(['low', 'medium', 'high'] as const).flatMap((k) =>
        fact.byImpact?.[k] ? [[`byImpact.${k}.`, fact.byImpact[k]] as const] : [],
      ),
    ] as const;
    return versions.flatMap(([prefix, v]) =>
      (['statement', 'partialStatement', 'statementTerse', 'statementSimple'] as const).flatMap(
        (key): [string, string][] => {
          const value = (v as Record<string, string | undefined>)[key];
          return value ? [[`${prefix}${key}`, value]] : [];
        },
      ),
    );
  };
  for (const fact of s.hiddenFacts) {
    for (const [source, statement] of statementsOf(fact)) {
      for (const token of distinctiveTokens(statement)) {
        for (const [where, text] of earlyText) {
          if (text.toLowerCase().includes(token)) {
            issues.push(
              `${s.id}: hidden fact "${fact.id}" ${source} token "${token}" leaks in ${where}`,
            );
          }
        }
      }
      // Wording copied from a hidden fact into anything said or shown earlier gives it away even
      // when it holds no number or code.
      for (const [where, text] of earlyText) {
        // Discovery areas are short topic labels ("Recent changes"), so only numbers and codes
        // matter there.
        if (where.startsWith('expectedDiscoveryAreas')) continue;
        const shared = sharedPhrase(statement, text);
        if (shared) {
          issues.push(
            `${s.id}: hidden fact "${fact.id}" ${source} is repeated ("${shared}") in ${where}`,
          );
        }
      }
    }
    // A hint points at its own fact, but must not give away another one.
    if (fact.hint) {
      for (const other of s.hiddenFacts) {
        if (other.id === fact.id) continue;
        for (const [source, statement] of statementsOf(other)) {
          const shared = sharedPhrase(statement, fact.hint);
          const tokens = distinctiveTokens(statement).filter((t) =>
            (fact.hint as string).toLowerCase().includes(t),
          );
          if (shared || tokens.length > 0) {
            issues.push(
              `${s.id}: the hint of "${fact.id}" gives away hidden fact "${other.id}" (${source})`,
            );
          }
        }
      }
    }
    for (const intent of [...fact.intents, ...(fact.partialIntents ?? [])]) {
      if (!DISCOVERY_INTENTS.includes(intent)) issues.push(`${s.id}: unknown intent ${intent}`);
    }
    if (fact.partialIntents?.length && !fact.partialStatement) {
      issues.push(`${s.id}: hidden fact "${fact.id}" has partialIntents but no partialStatement`);
    }
  }

  // Customers report symptoms in everyday words. A scenario never states product behaviour that
  // has not been validated, so it carries no versions, KB numbers, error codes, commands, links
  // or contact details.
  for (const [label, pattern] of PRODUCT_CLAIM_PATTERNS) {
    for (const [where, value] of allText(s)) {
      if (pattern.test(value)) issues.push(`${s.id}: ${label} in ${where}`);
    }
  }

  // Every difficulty must leave a workable scenario.
  const authoredTypes = new Set(s.curveballs.map((c) => c.type));
  for (const type of s.allowedCurveballs) {
    if (!authoredTypes.has(type) && !GENERIC_CURVEBALLS[type]) {
      issues.push(`${s.id}: allowed curveball "${type}" needs an authored definition`);
    }
  }
  if (!s.caseReference) {
    issues.push(
      `${s.id}: caseReference is needed, because the call stage can be changed to a follow-up, escalated or closure call`,
    );
  }

  // Every difficulty must leave a workable scenario (at the scenario's own call stage).
  for (const difficulty of ['starter', 'standard', 'challenge'] as Difficulty[]) {
    const facts = s.hiddenFacts.filter(
      (f) =>
        DIFFICULTY_RANK[f.minDifficulty] <= DIFFICULTY_RANK[difficulty] &&
        (!f.stages || f.stages.includes(s.callStage)),
    );
    if (!facts.some((f) => f.importance !== 'helpful')) {
      issues.push(`${s.id}: no critical or important hidden fact at ${difficulty} difficulty`);
    }
  }

  // Whatever stage the call is configured for, the customer can still say what the problem is.
  for (const stage of CALL_STAGES) {
    const known = s.knownFacts.filter((f) => !f.stages || f.stages.includes(stage));
    if (!known.some((f) => f.intents.includes('problem_description'))) {
      issues.push(`${s.id}: no known fact answers problem_description at the ${stage} stage`);
    }
  }
  if (s.coachingFocus.length === 0) issues.push(`${s.id}: coachingFocus is empty`);
  return issues;
}

let cache: LoadedScenarios | null = null;

/** Loads and validates the built-in library once. Throws if any scenario is invalid. */
export function getScenarioLibrary(): ScenarioDefinition[] {
  cache ??= loadScenarios();
  if (cache.errors.length > 0) {
    throw new Error(`Invalid scenario library:\n  ${cache.errors.join('\n  ')}`);
  }
  return cache.scenarios;
}
