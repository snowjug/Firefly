// Text patterns for reading CARE behaviour from what the trainee actually said. They are the
// rubric layer's own, so the engine's classifier lexicon can change without moving the rubric. The
// classification of each turn (flags and evidence quotes) is used first; these patterns confirm,
// veto or add to it. They look at what was said and where, never at spelling, grammar, accent,
// length or how fast someone talks.

// Contractions typed without their apostrophe ("im sorry", "dont worry"). They are the same words,
// so they are read as the same words: a missing apostrophe is a spelling habit, never a gap.
const BARE_CONTRACTIONS: [RegExp, string][] = [
  [/\bim\b/g, "i'm"],
  [/\bive\b/g, "i've"],
  [/\byoure\b/g, "you're"],
  [/\byouve\b/g, "you've"],
  [/\byoull\b/g, "you'll"],
  [/\btheyre\b/g, "they're"],
  [/\bthats\b/g, "that's"],
  [/\bwhats\b/g, "what's"],
  [/\bdont\b/g, "don't"],
  [/\bcant\b/g, "can't"],
  [/\bwont\b/g, "won't"],
  [/\bdidnt\b/g, "didn't"],
  [/\bdoesnt\b/g, "doesn't"],
  [/\bisnt\b/g, "isn't"],
  [/\barent\b/g, "aren't"],
  [/\bwasnt\b/g, "wasn't"],
  [/\bhavent\b/g, "haven't"],
  [/\bhasnt\b/g, "hasn't"],
  [/\bcouldnt\b/g, "couldn't"],
  [/\bwouldnt\b/g, "wouldn't"],
  [/\bshouldnt\b/g, "shouldn't"],
  // "ill" is also a word, so it is only "I'll" before a verb a support engineer would promise.
  [
    /\bill (?=(?:call|unlock|look|check|send|update|get|take|stay|own|make|fix|sort|raise|escalate|arrange|follow|come|be|let|try|see|find|speak|ring|phone|email|message|contact|chase|investigate|review|test|log|open|report|reach|talk|personally|handle|resolve|restore|reset|keep)\b)/g,
    "i'll ",
  ],
];

/** Lower-cases, straightens quotes and collapses spaces, so patterns can use a plain apostrophe. */
export const norm = (text: string): string => {
  let out = text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [pattern, replacement] of BARE_CONTRACTIONS) out = out.replace(pattern, replacement);
  return out;
};

/** Sentences as written, split without needing capital letters (speech-to-text often has none). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[a-z0-9]/i.test(s));
}

// ---------------------------------------------------------------------------------------
// Opening: greeting, introduction, confirming who and what

export const GREETING =
  /\b(?:hello|hi|hey|good (?:morning|afternoon|evening)|welcome|thanks? for (?:calling|contacting|reaching out|getting in touch)|thank you for (?:calling|contacting|reaching out|getting in touch))\b/;

export const OFFERS_HELP =
  /\b(?:how (?:can|may|could) (?:i|we) (?:help|assist)|what can i do for you|happy to help|here to help|i can help|glad to help|i'?d be happy to|let me help)\b/;

// Words that can follow "I'm" or "this is" without being a name.
const NOT_A_NAME = new Set(
  (
    'a an the your our my not just here there sorry afraid happy glad sure so very really truly trying looking going able unable aware worried calling sending checking still now also from with at on in that what who how why when where which one two another getting taking having being doing making writing reaching contacting following listening waiting working pleased delighted available ready certain curious keen familiar new old good great fine ok okay well late early busy free done back up down out over next last first second third thinking wondering hoping guessing assuming expecting supposed about as for to of by if is are was were be been it this these those all any some no yes can will would could should may might must do does did ' +
    'microsoft support teams outlook azure windows office exchange sharepoint onedrive entra intune defender dynamics power copilot service helpdesk desk team technical customer premier unified escalation senior product engineering engineer specialist advisor adviser agent analyst technician consultant representative'
  ).split(' '),
);

const NAME_AFTER_LEAD =
  /\b(?:my name is|my name's|this is|it's|i'm|i am|name's)\s+([\p{L}][\p{L}'-]*)([^.?!]*)/giu;
const NAME_BEFORE_WORD = /\b([\p{Lu}][\p{L}'-]*)\s+(?:speaking|here)\b/gu;

// Names that are also words. "I'm Will" and "my name is May" give a name; "I will help you" and "may
// I ask" do not, and neither does "it's May 5th".
const NAME_AS_WORD = new Set(['will', 'may']);
const INTRO_CONTINUES = /^(?:from|with|at|on|speaking|here)\b/;

/** True when the sentence gives a name: "my name is Sam", "this is Sam from ...", "Sam speaking". */
export function givesName(sentence: string): boolean {
  const text = sentence.replace(/[\u2018\u2019\u201b]/g, "'").replace(/\b[Ii]m\b/g, "I'm");
  for (const match of text.matchAll(NAME_AFTER_LEAD)) {
    const lead = norm(match[0]);
    const word = norm(match[1] ?? '');
    const rest = norm(match[2] ?? '');
    const capital = /^\p{Lu}/u.test(match[1] ?? '');
    if (word.length < 2) continue;
    const alsoAWord = NAME_AS_WORD.has(word);
    if (NOT_A_NAME.has(word) && !alsoAWord) continue;
    // "My name is Will": the lead says what follows is a name, whatever else the word means.
    if (/^(?:my name is|my name's|name's)/.test(lead)) return true;
    if (alsoAWord) {
      // Anywhere else it has to read as a name: "I'm Will", "this is May from support".
      const after = rest.replace(/^[,\s]+/, '');
      const reads = capital
        ? /^(?:i'm|i am)\b/.test(lead) || after === '' || INTRO_CONTINUES.test(after)
        : INTRO_CONTINUES.test(after);
      if (reads) return true;
      continue;
    }
    // A capital letter in mid-sentence marks a name. Without capitals (speech-to-text) a name is
    // recognised by what follows it.
    if (capital) return true;
    if (/^(?:from|with|at|on|speaking|here|and|in)\b/.test(rest)) return true;
  }
  for (const match of text.matchAll(NAME_BEFORE_WORD)) {
    const word = norm(match[1] ?? '');
    if (!NOT_A_NAME.has(word) || NAME_AS_WORD.has(word)) return true;
  }
  return false;
}

const SELF = "(?:this is|i'?m|i am|my name(?:'s| is)|it'?s|name'?s)";
const TEAM_WORDS =
  '(?:support|team|desk|service|helpdesk|help desk|engineering|engineers?|specialists?|department|group|microsoft|unit|centre|center|operations)';
// "I'm from the support team", "this is Sam with Contoso support": the team follows the speaker's
// own introduction, so "I'm sorry you're stuck with the front desk waiting" is not one.
const TEAM_AFTER_SELF = new RegExp(
  `\\b${SELF} (?:[\\p{L}'-]+,? ){0,2}?(?:from|with|at|on|part of|a member of)\\s+(?:the |our |a |an |your )?(?:[a-z0-9&'-]+ ){0,3}${TEAM_WORDS}\\b`,
  'u',
);
const WORKS_FOR = new RegExp(
  `\\b(?:i work (?:for|with|in|on|at)|i'?m working (?:for|with|in|on|at)|calling from|here from|here at)\\s+(?:the |our |a |an |your )?(?:[a-z0-9&'-]+ ){0,3}${TEAM_WORDS}\\b`,
);
// "Thanks for calling Contoso support, this is Sam": the team can come before the name. Only a
// frame that names the team counts, so "I can see you've called us before" is not an introduction.
const CALLING_TEAM = new RegExp(
  `\\b(?:you'?ve reached|you'?re through to|you'?ve come through to|thanks? for calling|thank you for calling|thanks? for contacting|thank you for contacting|welcome to)\\s+(?:the |our )?(?:[a-z0-9&'-]+ ){0,3}${TEAM_WORDS}\\b`,
);
// "You're speaking with Sam from the support team": a name after a frame that introduces the speaker.
const NAME_AFTER_REACHED =
  /\b(?:you'?ve reached|you'?ve come through to|you'?re (?:through to|speaking (?:with|to)|talking (?:with|to)))\s+(?:the |our )?(\p{Lu}[\p{L}'-]*)/u;
const TEAM_AFTER_REACHED = new RegExp(
  `\\b(?:you'?ve reached|you'?ve come through to|you'?re (?:through to|speaking (?:with|to)|talking (?:with|to)))\\s+(?:the |our )?[\\p{L}'-]+ (?:from|at|with|on)\\s+(?:the |our )?(?:[a-z0-9&'-]+ ){0,3}${TEAM_WORDS}\\b`,
  'u',
);
const ROLE_AFTER_SELF = new RegExp(
  `\\b${SELF} (?:[\\p{L}'-]+,? ){0,2}?(?:a|an|the|your) (?:[a-z-]+ ){0,2}(?:engineer|specialist|advisor|adviser|agent|analyst|technician|consultant|representative)\\b`,
  'u',
);
const NAME_FROM =
  /(?:^|[.,!?]\s*|\b(?:hello|hi|hey|good (?:morning|afternoon|evening))[,.]?\s+)(?!(?:Microsoft|Support|Teams|Outlook|Azure|Windows|Office|Exchange|SharePoint|OneDrive|Entra|Intune|Defender|Dynamics|Power)\b)([\p{Lu}][\p{L}'-]+)\s+(?:from|at|with)\s+(?:the\s+)?[\p{L}0-9&' -]{2,40}?(?:support|team|desk|service|helpdesk|engineering|department)\b/u;

export interface IntroSignals {
  lead: boolean; // the sentence introduces the speaker
  name: boolean;
  team: boolean; // a team, desk, service or company
  role: boolean; // a job role
}

export function introSignals(sentence: string): IntroSignals {
  const text = sentence.replace(/[\u2018\u2019\u201b]/g, "'").replace(/\b[Ii]m\b/g, "I'm");
  const lower = norm(sentence);
  const nameFrom = NAME_FROM.test(text);
  const reachedName = NAME_AFTER_REACHED.exec(text)?.[1];
  const name =
    givesName(sentence) ||
    nameFrom ||
    (reachedName !== undefined && !NOT_A_NAME.has(norm(reachedName)));
  const team =
    TEAM_AFTER_SELF.test(lower) ||
    WORKS_FOR.test(lower) ||
    CALLING_TEAM.test(lower) ||
    TEAM_AFTER_REACHED.test(lower) ||
    (nameFrom && new RegExp(TEAM_WORDS).test(lower));
  const role = ROLE_AFTER_SELF.test(lower);
  return { lead: name || team || role, name, team, role };
}

const NAMED_ITEM = '(?:name|number|reference|id|address|details|domain|tenant)';
const NAME_QUALIFIER =
  '(?:(?:full|first|last|company|organi[sz]ation|case|ticket|reference|account|tenant|domain|email|contact|phone|callback|call-back) ){0,2}';
export const IDENTITY = new RegExp(
  `\\b(?:am i (?:speaking|talking) (?:with|to)|who am i (?:speaking|talking) (?:with|to)|(?:could|can|would|may) (?:i|you) (?:please )?(?:confirm|give me|tell me|take|get|have|spell|provide|check|read me) (?:your|the) ${NAME_QUALIFIER}${NAMED_ITEM}(?! of\\b)|is that (?:the right|your) ${NAME_QUALIFIER}(?:name|account|case|number))`,
);
export const CASE_CONTEXT =
  /\b(?:case (?:number|id|reference|notes|history|file)\b|sim-\d{6}\b|(?:about|regarding|for|on) (?:your|the|this) (?:case|ticket|incident|service request)\b|(?:which|what) (?:case|ticket)\b|i (?:can )?(?:see|have|'ve got|am looking at|'m looking at|have open|pulled up) (?:your|the|that|this|you)\b[^.?!]{0,40}\b(?:case|ticket|notes|history|account|details|record)\b|(?:you(?:'re| are)|you were) (?:calling|ringing|getting in touch|contacting us) (?:about|because|regarding|to|in connection with)\b|calling (?:about|regarding|in connection with)\b|(?:reason|purpose) (?:for|of) (?:your|the) call\b|you (?:wanted|want|would like|'d like) to (?:check|confirm|close|talk|ask|know|discuss|follow)\b|is this (?:about|regarding|in connection with|the same)\b)/;

/** Putting back in the trainee's own words what the customer has just said. */
export const REFLECT_FRAME =
  /\b(?:so|you (?:said|mentioned|told me|explained|say)|it sounds like|i (?:hear|gather|see|take it|understand that)|if i (?:understand|heard)|what i'?m hearing|as you (?:said|mentioned)|thanks for (?:explaining|telling|letting me know|sharing)|you'?re (?:saying|telling me)|that'?s (?:helpful|useful)|good to know)\b/;

// ---------------------------------------------------------------------------------------
// Questions and checks

export const QUESTION_START =
  /^(?:and |so |ok(?:ay)?,? |right,? |also |now |just )?(?:what|when|where|why|how|which|who|whose|can you|could you|would you|will you|do you|did you|have you|has it|has the|is there|are there|is it|are you|were you|was it|does it|did it|is that|were there|any |anything )\b/;

// A request for information worded as a statement: "Tell me what happens when you sign in."
const REQUEST_PHRASE =
  /\b(?:tell me|walk me through|talk me through|describe|explain (?:to me )?(?:what|how|when)|let me know|help me understand|i (?:need|want|would like|'d like) to (?:know|understand|find out|ask|check|confirm|see|get)|read (?:me|it|that)|show me|could you (?:tell|share|describe|explain|confirm)|can you (?:tell|share|describe|explain|confirm|read))\b/;

export const isQuestionSentence = (sentence: string): boolean => {
  const lower = norm(sentence);
  return sentence.trim().endsWith('?') || QUESTION_START.test(lower) || REQUEST_PHRASE.test(lower);
};

/** A check that the customer followed or agrees ("does that make sense?", "is that right?"). */
export const CHECK_BACK =
  /\b(?:does (?:that|this|it|all of that) (?:make sense|work|sound (?:right|good|ok|okay|fair|reasonable|clear)|help|sit (?:well )?with you)|is (?:that|this|everything) (?:right|correct|ok|okay|clear|fair|accurate|alright|all right|good|fine)|have i (?:got|understood|missed)|did i (?:get|understand|miss)|am i (?:right|correct|understanding|missing)|do i have (?:that|this|it) (?:right|correct)|are you (?:happy|ok|okay|comfortable|alright|fine|clear) with (?:that|this|it|the plan)|how does that sound|are you with me|did that (?:make sense|help)|can you confirm (?:that|you|it)|would that work|shall we (?:go ahead|proceed|do that)|does that match)\b/;

/** Asking whether the problem is gone, as a closure call needs. */
export const RESOLUTION_CHECK =
  /\b(?:is (?:it|that|everything|the (?:problem|issue|fix)|your \w+) (?:now )?(?:working|resolved|fixed|sorted|back|ok|okay|all good|behaving)|(?:are|were) you (?:now )?(?:able|back|signed|working|seeing)|(?:has|have|did|does|can|could) (?:it|that|the (?:problem|issue|fix|change|update|workaround)|everything|you)\b[^.?!]{0,40}\b(?:work(?:ed|ing)?|resolved|fixed|sorted|come back|returned|happen(?:ed)? again|sign in|open|connect)\b|any (?:further|more|new|other) (?:problems|issues|errors|symptoms)|still (?:seeing|getting|happening|have))\b/;

/** Asking whether the customer agrees to close or accepts the outcome. */
export const AGREEMENT_CHECK =
  /\b(?:(?:are you|is that|is this|would that be|would it be) (?:happy|ok|okay|fine|alright|all right|comfortable|good|agreed)\b[^.?!]{0,30}\b(?:close|closing|that|this|the (?:plan|outcome|result)|it)\b|(?:happy|ok|okay|fine|comfortable) (?:for us )?to close|(?:are you )?ready to close|(?:can|shall|may|could|should) (?:we|i) (?:close|go ahead and close)|would you like (?:me |us )?to close|do you (?:agree|mind (?:if|us|me)|want (?:me |us )?to close)|we(?:'re| are) agreed|(?:that|this) works? for you|are we (?:good|agreed|all set))\b/;

export const SUMMARY_FRAME =
  /\b(?:(?:so|ok(?:ay)?|right|alright),? (?:just )?to (?:summari[sz]e|recap|confirm|make sure|check|clarify|be clear)|let me (?:just )?(?:summari[sz]e|recap|repeat|play (?:it|that) back|read (?:it|that) back|confirm|make sure i|check i)|to (?:summari[sz]e|recap|sum up)|in summary|in short|if i(?:'ve| have)? (?:understood|got (?:this|that|it)|heard)|what i(?:'m| am) (?:hearing|understanding)|my understanding is|do i have (?:that|this|it) right|is that (?:right|correct|accurate)|have i (?:got|understood)|so (?:what|if) you'?re saying|so (?:you|it)(?:'re| are| is| was| have| had|'ve|'s| started| can'?t| cannot| won'?t)|sounds like|so (?:basically|essentially)|just so i(?:'m| am) (?:clear|sure|following)|so to be clear|here'?s where (?:we|things) (?:are|stand)|so we have|what we(?:'ve| have) (?:covered|agreed|got))\b/;

// ---------------------------------------------------------------------------------------
// Empathy and tone

/** A phrase of sympathy or understanding. On its own it is a generic one. */
export const EMPATHY =
  /\b(?:i'?m (?:so |really |very |truly |terribly |sincerely |awfully )?sorry|i am (?:so |really |very |truly |terribly |sincerely )?sorry|i (?:do |truly |really |sincerely )?apologi[sz]e|my apologies|apologies|sorry (?:to hear|about|for|that)|i (?:completely |totally |fully |really |do )?understand|i (?:can )?(?:see|hear|appreciate|imagine|sense|recognise|recognize) (?:that|how|why|what|your|you)|i (?:totally |completely )?get (?:it|that|why|how)|that (?:sounds|seems|must be|must have been|is|would be|has got to be|has to be)(?: like)?(?: a)?(?: really| very| so| quite| incredibly| extremely)? (?:frustrating|stressful|difficult|hard|annoying|worrying|upsetting|inconvenient|tough|worrisome|disruptive|awful|horrible|a lot|not (?:ok|okay|good))|must be (?:really |very |so )?(?:frustrating|stressful|difficult|hard|worrying|upsetting)|thank(?:s| you) for (?:your )?(?:patience|bearing with|waiting)|appreciate your patience|i know (?:this|that|it)(?:'s| is| has been)? (?:frustrating|stressful|not easy|difficult|hard|worrying)|that'?s (?:really )?(?:frustrating|stressful|worrying|not good enough)|no wonder (?:you(?:'re| are| have|'ve)|that)|i can only imagine|that'?s (?:completely |totally |perfectly |very )?understandable|i(?:'d| would) be (?:frustrated|upset|worried|annoyed|stressed|anxious) too|i don'?t blame you|i feel for you|what a (?:stressful|frustrating|horrible|awful|difficult|tough|worrying) (?:start|spot|position|situation|morning|day|week))\b/;

export const APOLOGY = /\b(?:sorry|apologi[sz]e|apologies)\b/;

/** Words that frame empathy as being about something in particular. */
export const SPECIFIC_FRAME =
  /\b(?:especially|particularly|given (?:that|the|your)|with (?:the|your)|when you|since you|because you|you'?ve been|you can'?t|you cannot|you are (?:unable|stuck)|you(?:'re| are) (?:waiting|stuck|locked|blocked|trying|having))\b/;

/** What a customer is feeling, named. */
export const FEELING_WORDS =
  /\b(?:frustrat\w*|stress\w*|worr\w*|anxious|anxiety|upset\w*|annoy\w*|angry|concern\w*|urgent\w*|pressure|difficult|stuck|blocked|waiting|wait|disrupt\w*|inconvenien\w*|chase|chasing|delay\w*)\b/;

// Impatience with the customer. Words that are only impatient in a particular use are anchored to
// it: "as I said" recalls a promise ("I'll ring at 3 as I said"), "come on" and "whatever" are
// ordinary words ("does the screen come on?"), so only the scolding forms are matched.
export const IMPATIENT = new RegExp(
  [
    String.raw`\bas i (?:already|have already|just) (?:said|told you|explained)\b`,
    String.raw`\blike i (?:already|just) (?:said|told you)\b`,
    String.raw`\bi (?:already|have already|just) (?:told|explained|said)(?: (?:it|this|that))?(?: to)? you\b`,
    String.raw`\bi don'?t have (?:time|all day)\b`,
    // An order to the customer, not "I'll ask the engineers to hurry up".
    String.raw`(?:^|[,;] ?|\bplease |\bjust )hurry up\b`,
    String.raw`\bjust (?:tell me|answer)\b`,
    String.raw`\bcalm down\b`,
    String.raw`\byou(?:'re| are) not (?:listening|making sense)\b`,
    String.raw`\bthat'?s a (?:stupid|silly|ridiculous) question\b`,
    // The whole sentence is the brush-off.
    String.raw`^(?:(?:oh|ok(?:ay)?),? )?(?:whatever|come on)\W*$`,
  ].join('|'),
);

export const DISMISSIVE =
  /\b(?:calm down|don'?t worry about it|no (?:big|great) deal|(?:it'?s|that'?s) not (?:a |that |really |such )?(?:big|major|serious)(?: of)?(?: a)? (?:deal|issue|problem|thing)|(?:it'?s|that'?s) (?:just|only|simply) (?:a |an )?(?:minor|small|simple|little)|you(?:'re| are) (?:over ?reacting|exaggerating|making (?:a )?(?:fuss|scene|big deal))|nothing to (?:worry|be (?:upset|angry|worried)) (?:about)?|there'?s nothing (?:i|we) can (?:do|say)|that'?s (?:just|simply) how it (?:works|is)|not the end of the world|relax)\b/;

// Blame. "You should have restarted it" scolds. "You shouldn't have to chase us", "you must have been
// waiting" and "you were supposed to hear from us" use the same words to take the customer's side,
// so a modal form is blame only when it is about something the customer did.
const OWED = String.raw`(?:(?:heard|received|got|gotten)|had (?:an? |some |any |more |better |the )?(?:update|call|callback|call back|reply|response|answer|email|message|confirmation|news|help|support|apology|follow-up|resolution|reminder)s?|been (?:told|given|sent|contacted|called|updated|notified|informed|offered|provided|kept|helped|answered|looked after))`;
const OWED_TO_BE = String.raw`(?:receive|get|hear|have (?:received|heard|been|had|got)|be (?:contacted|called|told|sent|given|updated|notified|informed|offered|provided|helped))`;
const WENT_WRONG = String.raw`(?:clicked|pressed|changed|deleted|typed|entered|selected|installed|removed|disabled|turned|set|configured|misconfigured|done|missed|forgotten|ignored|skipped|broken|messed|mistyped|overlooked|accidentally|made (?:a |an )?(?:mistake|error|typo))`;

/** Blame that nobody says kindly. */
export const BLAME_CLEAR =
  /\b(?:you (?:failed to|forgot to|didn'?t (?:follow|read|check|make sure|tell)|need to be more careful|broke|caused|messed|misconfigured)|your (?:fault|mistake|error)|user error|that'?s on you|not (?:our|my) (?:problem|fault|issue)|(?:caused|broken|done) by you)\b/;

/** Blame that can also be sympathy, as long as it is about something the customer did. */
export const BLAME_MODAL = new RegExp(
  String.raw`\byou (?:should have\b(?! ${OWED}\b)|shouldn'?t have\b(?! (?:to|had|needed|been)\b)|were supposed to\b(?! ${OWED_TO_BE}\b)|must have ${WENT_WRONG}\b)`,
);

/** Either kind of blame: the words alone, before the rest of the sentence is weighed. */
export const BLAME = new RegExp(`${BLAME_CLEAR.source}|${BLAME_MODAL.source}`);

// The same words used kindly, which the engine's classification also marks as blame.
const KIND_MODAL = new RegExp(
  String.raw`\byou (?:should have ${OWED}\b|shouldn'?t have (?:to|had|needed|been)\b|were supposed to ${OWED_TO_BE}\b|must have (?!${WENT_WRONG}\b)\w+)`,
);
const MODAL_FORM = /\byou (?:should have|shouldn'?t have|were supposed to|must have)\b/;
const TAKEN_BACK = /\b(?:but|however|although|though)\b/;

/** An apology or sympathy that the sentence does not take back with a "but". */
export const saidKindly = (lower: string): boolean =>
  (APOLOGY.test(lower) || EMPATHY.test(lower)) && !TAKEN_BACK.test(lower);

/**
 * Whether a sentence the engine's classification marked as blame is really kindness: "you shouldn't
 * have to chase us" holds the same words as "you shouldn't have changed it". Blame the sentence
 * also contains is never excused, and neither is a modal form after "I'm sorry, but".
 */
export function readsAsKindness(sentence: string): boolean {
  const lower = norm(sentence);
  if (BLAME_CLEAR.test(lower)) return false;
  if (KIND_MODAL.test(lower) && !BLAME_MODAL.test(lower)) return true;
  return MODAL_FORM.test(lower) && saidKindly(lower);
}

// "As I said" and "I already told you" recall what was said. Only the scolding forms (IMPATIENT)
// and the brush-offs (DISMISSIVE) are held against the engineer.
const RECALL =
  /\b(?:(?:as|like) i (?:said|told you|mentioned)|i (?:already|have already) (?:told|explained|said|mentioned))\b/;

/** Whether a sentence the engine's classification marked as dismissive only recalls what was said. */
export function readsAsRecall(sentence: string): boolean {
  const lower = norm(sentence);
  return RECALL.test(lower) && !IMPATIENT.test(lower) && !DISMISSIVE.test(lower);
}

export const HEDGED =
  /\b(?:could|might|may be|maybe|perhaps|possibly|not sure|unsure|wondering|if)\b/;

// ---------------------------------------------------------------------------------------
// Accountability

/** The trainee speaking about what they themselves will do. */
export const FIRST_PERSON_COMMIT =
  /\b(?:i(?:'ll| will| am going to|'m going to|'m gonna|'ve got| can take)|let me|leave (?:it|this) with me|this is (?:my|mine)|i(?:'m| am) (?:taking|handling|responsible|on it)|i own|i take (?:ownership|responsibility))\b/;
/** "We will ..." is the organisation speaking: a weaker commitment than "I will ...". */
export const WE_COMMIT = /\bwe(?:'ll| will| are going to|'re going to)\b/;

/** Taking on the outcome: owning, seeing it through, getting it sorted. */
export const OWNS_OUTCOME =
  /\b(?:own (?:this|it|that)|take (?:ownership|charge|responsibility|this on|it on|care of this|care of it)|handle (?:this|it)|see (?:this|it) through|stay (?:on|with) (?:this|it|you|the case)|stick with (?:this|it|you)|make sure (?:this|it|that|everything)|ensure (?:this|it|that)|follow (?:this|it) (?:up|through)|chase|personally|(?:my|mine) (?:case|priority|responsibility)|leave (?:it|this) with me|get (?:this|it|that|the \w+|your \w+|everything)\b[^.?!]{0,25}?\b(?:sorted|resolved|fixed|restored|unlocked|working|moving|running|unblocked|reactivated|enabled|escalated|raised)|(?:fix|resolve|sort|unlock|restore|escalate|expedite)(?: this| it| that| the \w+| your \w+)?(?: out)?(?: for you)?)\b/;

/** An action that is looked into or reported on: a commitment to do something, but not to the outcome. */
export const OWNS_ACTION =
  /\b(?:look(?:ing)? into|investigate|investigating|check|review|test|raise|log|open a|arrange|organi[sz]e|coordinate|call you|phone you|ring you|email you|message you|update you|get back to you|come back to you|report back|reach out|send|follow ?up|find out|speak to|talk to|contact)\b/;

export const COMMIT_HEDGE =
  /\b(?:try(?:ing)? to|i'?ll try|we'?ll try|hopefully|might|maybe|perhaps|should be able|i think we can|see if|see what|probably|could possibly)\b/;

/** Someone else will do it: no commitment from the trainee. */
export const THIRD_PARTY =
  /\b(?:someone|somebody|the team|our team|the engineers?|the specialists?|a colleague|another team|the (?:support )?(?:desk|department)|they|support|people)\b[^.?!]{0,15}\b(?:will|should|can|might|may|could|'ll|is going to|are going to)\b/;

export const TIME_REF =
  /\b(?:\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)|\d{1,2}:\d{2}|\d+\s?(?:minutes?|mins?|hours?|hrs?|days?)|(?:one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty-?five|sixty|half an?|a couple of|a few)\s+(?:minutes?|mins?|hours?|hrs?|days?)|an hour|half an hour|a quarter of an hour|tomorrow|today|tonight|this (?:morning|afternoon|evening)|(?:mon|tues|wednes|thurs|fri|satur|sun)day|end of (?:the |today|business|day)|close of (?:business|play)|cob|eod|noon|midday|midnight|o'?clock|(?:quarter|half) (?:past|to) \w+|(?:at|by|before|until|around) (?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?! (?:of|more|other|thing|time|people|person)))\b/;

export const CADENCE =
  /\b(?:every (?:other )?(?:day|morning|afternoon|evening|hour|week|\d+ (?:minutes?|hours?|days?))|each (?:day|morning|afternoon|evening|hour|week)|daily|hourly|weekly|twice a day|once a day|until (?:it(?:'s| is)|this is|we(?:'ve| have)) (?:resolved|fixed|sorted|closed))\b/;

export const VAGUE_TIME =
  /\b(?:soon|shortly|as soon as (?:possible|i can|we can)|asap|in due course|sometime|later|in a (?:bit|while)|when i (?:have|get) (?:an update|news|something)|at some point|keep you (?:posted|updated|in the loop)|be in touch|get back to you|let you know)\b/;

export const UPDATE_ACTION =
  /\b(?:update|call|phone|ring|email|message|text|contact|check in|get back|come back|report back|touch base|follow ?up|speak|be in touch|let you know|keep you (?:posted|updated))\b/;

const PROMISE_VERB =
  /\b(?:i (?:can )?(?:promise|guarantee|assure you|swear)|(?:it|this|that|everything)(?:'ll| will| is going to| should (?:definitely|certainly))|(?:will|'ll) (?:definitely|certainly|absolutely)|no (?:problem|worries),? (?:it|this)(?:'ll| will))\b/;
const OUTCOME_WORD =
  /\b(?:fixed|resolved|sorted|working|back (?:up|online|to normal)|restored|solved|up and running|live again|done|fix(?:ed)? (?:this|it)|resolve (?:this|it)|sort(?:ed)? (?:this|it) out)\b/;
const CHECKING_ONLY = /\b(?:check|confirm|see (?:if|whether)|find out|make sure|verify|test)\b/;
export const REALISTIC_PROMISE =
  /\b(?:(?:can'?t|cannot|can not|won'?t|not (?:able|going) to|don'?t want to|unable to|wouldn'?t want to) (?:promise|guarantee|commit)|i don'?t want to (?:over ?promise|give you a (?:time|date) i can'?t))\b/;

/**
 * "I'll check whether it is fixed and call you at nine" promises a check, not an outcome. The
 * classification can mistake it for a promise of a fix, so a flag on such a sentence is not taken
 * as one.
 */
export function promisesOnlyToCheck(sentence: string): boolean {
  const lower = norm(sentence);
  return CHECKING_ONLY.test(lower) && !PROMISE_VERB.test(lower);
}

/** A promise of an outcome or a time that nobody can know yet ("I guarantee it will be fixed by tonight"). */
export function isUnsupportedPromise(sentence: string): boolean {
  const lower = norm(sentence);
  if (REALISTIC_PROMISE.test(lower) || lower.endsWith('?')) return false;
  if (PROMISE_VERB.test(lower) && OUTCOME_WORD.test(lower) && !CHECKING_ONLY.test(lower)) {
    return true;
  }
  return (
    OUTCOME_WORD.test(lower) &&
    TIME_REF.test(lower) &&
    /\b(?:will|'ll|going to|should)\b/.test(lower) &&
    !/\bupdate\b/.test(lower) &&
    !CHECKING_ONLY.test(lower)
  );
}

export const EXPECTATION =
  /\b(?:i (?:can'?t|cannot|won'?t|don'?t) (?:promise|guarantee|say|know) (?:yet|when|how long|exactly)|i (?:don'?t|do not) (?:yet )?know (?:yet|how long|when|exactly|what)|what (?:i|we) can (?:do|commit to|promise) is|it (?:may|might|could|will) take (?:up to |about |around |a few )?\w+|the next step is|here'?s what (?:will )?happen|what happens next|what to expect|you can expect|(?:i|we)(?:'ll| will) know more (?:once|when|after)|until i know|i'?ll be able to (?:tell|say) you more|realistically|i can commit to)\b/;

export const PROGRESS =
  /\b(?:here'?s (?:where|what|the)\b|so far\b|since (?:we|you|i|the case)\b|the (?:current )?status\b|where (?:we|things|your case) (?:are|stand)|(?:i|we)(?:'ve| have) (?:checked|reviewed|looked|spoken|raised|escalated|confirmed|found|sent|asked|made)\b|(?:i|we) can see (?:that )?(?:the|your) (?:case|ticket|notes|request|incident|engineers?|team)\b|the (?:engineers?|team|specialists?) (?:have|has|are|is) (?:been )?\w+|has (?:been|now been) (?:raised|escalated|assigned|updated|reviewed)|what'?s (?:happened|been done)|progress on)/;

export const HISTORY =
  /\b(?:you (?:called|contacted|rang|phoned|reached out|raised|logged|emailed|spoke to us)|(?:the|your|an?) (?:earlier|previous|last|first|second) (?:call|contact|case|ticket|conversation|chat|email)|yesterday'?s (?:call|contact|case|ticket|conversation)|since (?:we|you|i|the case) (?:last )?(?:spoke|talked|called|raised|opened)|the case (?:notes|history|was|has been|is)|(?:case|ticket) (?:notes|history)|i can see (?:that )?(?:you|the case|your case|the notes|it was|this was|the history)|i(?:'ve| have) (?:read|reviewed|looked at|gone through) (?:the|your) (?:case|notes|history)|i(?:'ve| have) (?:read|reviewed|looked at|gone through) (?:what|everything|all)\b[^.?!]{0,30}\b(?:happened|before|so far|earlier|history)|(?:more than one|several|multiple|a few|two) (?:calls?|contacts?|attempts?)|what(?:'s| has| had) happened (?:so far|before|already|earlier)|what happened (?:before|earlier|last time)|been through (?:this|all of this)|last time|as (?:we|you|i) (?:discussed|said|agreed|mentioned)|(?:been|having been) waiting|had to (?:chase|call|ring) (?:us |again)|(?:sorry|apologi[sz]e)[^.?!]{0,30}\b(?:wait|delay|chase|chasing|again|second (?:call|time)|earlier|not (?:been )?(?:resolved|sorted|fixed)))\b/;

export const ESCALATION =
  /\b(?:escalat\w*|bring(?:ing)? in|brought in|loop(?:ing)? in|looped in|raise (?:this|it|that) (?:with|to)|hand (?:this|it) (?:over|to)|pass (?:this|it) (?:to|on)|(?:senior|specialist|engineering|product group|resolver|escalation) (?:engineer|team|specialist|group|level|manager)s?|(?:our|the) (?:specialists?|engineers?|engineering team)|second pair of eyes|colleague|manager|supervisor)\b/;
export const ESCALATION_EXPLAINED =
  /\b(?:so that|which means|that means|who (?:will|can|is)|they(?:'ll| will| can)|will (?:review|look|investigate|take|check|work)|to (?:get|look|review|investigate|check|find|work)|because|in order to)\b/;
export const CUSTOMER_WANTS_ESCALATION =
  /\b(?:manager|supervisor|someone (?:more )?(?:senior|experienced)|higher up|team leader|escalat\w*)\b/;

export const THANKS_CLOSE =
  /\b(?:thank(?:s| you)(?: (?:so much|very much|for (?:your time|calling|your patience|bearing)))?|have a (?:good|great|nice|lovely)|take care|good ?bye|bye(?: for now)?|speak (?:to you )?soon|it'?s been a pleasure)\b/;

export const ANYTHING_ELSE =
  /\b(?:anything else|is there anything (?:else|more|further|other|i can|we can|you(?:'d| would) like|still)|any (?:other|further|remaining|outstanding) (?:questions|issues|concerns|problems)|anything (?:still )?(?:worrying|bothering|outstanding|on your mind)|have i (?:answered|covered)|any questions)\b/;

export const COMMITMENT_BACK =
  /\b(?:as (?:we )?(?:agreed|discussed)|i said i(?:'d| would)|i(?:'ve| have) (?:done|completed|sent|raised|escalated|called)|the update i promised|we agreed)\b/;

// ---------------------------------------------------------------------------------------
// Words, for checking that something said refers to what the customer actually said

const STOP = new Set(
  "about above after again against being below between could doing during each from further have having here itself just more most other over same should some such than that their them then there these they this those through under until very were what when where which while with would your yours because before only also into onto upon will been does done like make much must said well want even ever still back going gonna really thing things something anything nothing everything okay yeah right sure please thanks thank hello sorry understand help tell know need they're don't can't won't that's there's what's it's i'll i'm i've you're you'll you've we'll we're let's call calling today problem problems issue issues support look looking check checking happening trying able first time".split(
    ' ',
  ),
);

const stem = (word: string): string => {
  const w = word.replace(/'s$/, '');
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) return w.slice(0, -suffix.length);
  }
  return w;
};

/** The distinctive words of some text (four letters or more, no common words), lightly stemmed. */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of norm(text).match(/[a-z][a-z'-]{3,}/g) ?? []) {
    if (!STOP.has(word)) out.add(stem(word));
  }
  return out;
}

export function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const word of a) if (b.has(word)) n += 1;
  return n;
}

/** Words that name stakes: people waiting, deadlines, patients, customers and the like. */
export const STAKES_WORDS = new Set(
  'team patients customers clients staff users deadline launch event orders bookings revenue sales business operations meeting presentation investors director appointments checkout production desk morning blocked waiting'
    .split(' ')
    .map(stem),
);
