import type { DiscoveryIntent } from '#shared/domain/vocab.ts';

// Pattern families used by the demo-mode (rules) classifier. They are deliberately broad and
// forgiving: a trainee can phrase a question many ways. The live mode replaces this with a model
// that must return the same structured shape.

/** Lower-cases and normalises apostrophes so patterns can use a plain ' . */
export function prep(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitSentences(raw: string): string[] {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[a-z0-9]/i.test(s));
}

/** Cuts to a prefix (so it remains a verbatim substring) no longer than `max`. */
export function clip(sentence: string, max = 160): string {
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

// ---------------------------------------------------------------------------------------
// Questions and requests

export const QUESTION_START =
  /^(?:and |so |ok(?:ay)?,? |right,? |also |now |just )?(?:what|when|where|why|how|which|who|whose|can you|could you|would you|will you|do you|did you|have you|has it|has the|is there|are there|is it|are you|were you|was it|does it|did it|is that|were there|any |anything )\b/;

export const REQUEST_PHRASE =
  /\b(?:tell me|walk me through|talk me through|describe|explain (?:to me )?(?:what|how|when)|let me know|help me understand|i (?:need|want|would like|'d like|'m trying) to (?:know|understand|find out|ask|check|confirm|see|get)|read (?:me|it|that)|show me|share with me|i'?d like to (?:ask|know|understand)|could you (?:tell|share|describe|explain|confirm)|can you (?:tell|share|describe|explain|confirm|read))\b/;

// A sentence that starts like a question but states something: "What caused it was an old password."
const CLEFT =
  /^(?:what|all)\s+(?!is\b|was\b|are\b|were\b|'s\b)[a-z']+\b[^?]*\b(?:was|is)\s+(?:an?|the|that|because|due|caused|your|our|likely|probably|simply|just|basically)\b/;

/** Is this sentence asking something? Starting like a question is not enough when it ends as a statement. */
export function isAsking(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.endsWith('?')) return true;
  const lower = prep(sentence);
  if (/[.!]$/.test(trimmed) && CLEFT.test(lower)) return false;
  return QUESTION_START.test(lower) || REQUEST_PHRASE.test(lower);
}

// ---------------------------------------------------------------------------------------
// Housekeeping questions keep a call running without exploring the problem: asking for something
// to be repeated, asking leave to hold or call back, taking identity or contact details, checking
// the customer is happy to go on, and the closing "anything else?". They are never counted as
// discovery questions, so "Could you say that again?" cannot reveal a hidden fact.

const ID_NOUN =
  '(?:your (?:(?:full |first |last |sur|family )?name|e-?mail(?: address)?|(?:phone|mobile|contact|telephone|call-?back|direct) (?:number|no\\.?)|account (?:number|name|id|reference)|(?:case|ticket|reference|customer|licen[cs]e|subscription|service) (?:number|id|reference)|date of birth|dob|post ?code|job title|role|department|username|user name|user id|company(?: name)?|organi[sz]ation(?: name)?|spelling)|(?:a|the best|the) (?:phone|mobile|contact|telephone|call-?back|direct) (?:number|no\\.?)|(?:a|the) e-?mail address|the (?:right )?spelling)';
// What may follow a detail being asked for, as long as it does not start a second question.
const NO_SECOND_QUESTION =
  '(?:(?!\\b(?:when|what|which|who|how|why|where|did|has|have|had|is there|are there|since)\\b)[^?]){0,70}';

// Asking whether the customer has to do or give anything before the next update: "Is there
// anything you need to do from your side before then?", "Is there anything I need from you?", "Do
// you need anything from us?". It closes the call; it asks nothing about the problem. "Is there
// anything on your side that could explain it?" is a real question and is deliberately not matched.
export const ASKS_CUSTOMER_SIDE = new RegExp(
  [
    String.raw`\b(?:anything|something)\b[^.?!]{0,40}\b(?:you|i|we)(?:'d| would)?\b[^.?!]{0,16}\b(?:need|needs|want|require)\b[^.?!]{0,40}\b(?:from (?:me|us|you|your (?:side|end)|our (?:side|end)|my (?:side|end))|to (?:do|provide|send|share)\b[^.?!]{0,30}\b(?:from|on) (?:your|our|my) (?:side|end)|(?:on|from) (?:your|our|my) (?:side|end))`,
    String.raw`\bdo you need (?:me|us|anything)\b[^.?!]{0,30}\bfrom (?:me|us|you)\b`,
    String.raw`\banything you need to do (?:before|until|in the meantime|while)\b`,
  ].join('|'),
);

// Words that lead into a question without changing what it asks: "And what is your role there?"
const QUESTION_LEAD =
  /^(?:(?:and|so|ok(?:ay)?|right|alright|also|now|just|great|perfect|lovely|thanks|thank you|sorry|well)[,.]?\s+)+/;

const HOUSEKEEPING: RegExp[] = [
  ASKS_CUSTOMER_SIDE,
  // Asking for something to be repeated or said more slowly
  /^(?:(?:sorry|pardon|excuse me|apologies)[,.]? )?(?:could|can|would|will) you (?:please |just )?(?:say (?:that|it) (?:again|once more)|repeat (?:that|it|yourself|what you said)|speak (?:up|more (?:slowly|clearly)|a (?:bit|little) (?:louder|slower|more slowly))|slow down|spell\b)/,
  /^(?:sorry|pardon|come again|say again|what was that)\s*\??$/,
  // Audio, holding and waiting
  /^(?:can|could) (?:you|everyone) (?:hear|see) me\b/,
  /^(?:could|can|would|will) you (?:please |just )?(?:hold|bear with me|stay on the line|stay with me|wait|give me (?:a|one) (?:moment|minute|second|sec))\b/,
  /^(?:are you|is it) (?:able|ok|okay|possible)(?: for you)? to (?:stay|hold|wait)\b/,
  /^would it help if i (?:stayed|stay|held|hold)\b/,
  /^is (?:now|this) (?:a|the) (?:good|bad|convenient|right) time\b/,
  /^did (?:the|our) (?:earlier |last |previous )?(?:call|line|connection) (?:drop|cut|disconnect|go dead|fail)\w*/,
  // Leave to act, and offers to explain
  /^(?:do you mind if i|is it (?:ok|okay|alright|all right|fine)(?: with you)? (?:if i|to)|would it be (?:ok|okay|alright|all right|fine) (?:if i|to)|(?:shall|can|may|could|would) i) (?:just )?(?:put you on|place you on|phone|call|ring|email|text|send you|take your|get your|have your|record|open a|log a|raise a|go ahead and|confirm (?:your|that|i have|the (?:spelling|number|details)))\b/,
  /^(?:would you (?:like|prefer) me to|do you want me to|shall i|should i) (?:phone|call|ring|email|text|send|explain|walk you|go through|stay|hold|open|log|raise)\b/,
  /^would you (?:prefer|like) (?:an? )?(?:e-?mail|call ?back|phone call|call|text)\b/,
  /^have you got a (?:pen|pencil|paper|notepad)\b/,
  // Checking agreement, and the closing question. Each is anchored to the check alone: "Does it work
  // on your phone?" is a question about the problem, not a check that the plan suits the customer.
  /^(?:does|do) (?:that|this|it|all of that|(?:that|this|the) plan) (?:make sense|work(?: for you)?|sound (?:good|right|okay|ok|fair|reasonable)|help)(?: so far| for you| to you)?\s*[?.!]*$/,
  /^(?:is|are) (?:that|this|everything|all of that) (?:ok|okay|alright|all right|fine|right|correct|clear|good|accurate)(?: so far| for you| with you)?\s*[?.!]*$/,
  /^are you (?:happy|ok|okay|comfortable|alright|all right|fine) with (?:that|this|it|the plan)\b/,
  /^(?:is there )?anything (?:else )?(?:i|we) can (?:help|assist|do for you)\b/,
  /^how (?:can|may|could) (?:i|we) (?:help|assist)\b/,
  // A bare "how are you?" is a greeting. "How are you managing in the meantime?" and "How are you
  // affected by this?" are questions about the problem, so only the greeting itself matches.
  /^how (?:are you|is your (?:day|morning|afternoon))(?: doing| going| today| been| this (?:morning|afternoon|evening))?\s*[?.!]*$/,
  // Identity and contact details
  new RegExp(
    `^(?:what(?:'s| is| are)|can you (?:please )?(?:tell me|give me|confirm|provide|spell)|could (?:i|you) (?:please )?(?:have|get|take|confirm|give me|tell me)|may i (?:have|take|get)|can i (?:please )?(?:have|take|get|confirm)|is (?:that|this)) [^?]{0,12}?\\b${ID_NOUN}\\b${NO_SECOND_QUESTION}\\??$`,
  ),
  /^(?:who am i (?:speaking|talking) (?:with|to)|how would you like me to address you|what should i call you|is this the (?:number|phone|line) you(?:'re| are) (?:calling|ringing) (?:from|on))\b/,
  // Whether they have a case number to give is asking for their details, not whether they have called before.
  /^(?:do you (?:have|know)|have you got) (?:a|an|the|your) (?:case|ticket|reference|incident)(?: (?:number|id|reference|no\.?))?\b[^?]{0,30}\??$/,
];

/** True for a question that is housekeeping, so it can be left out of discovery. */
export function isHousekeepingQuestion(sentenceLower: string): boolean {
  const text = sentenceLower.trim();
  if (text.split(/\s+/).length > 18) return false;
  // "And what is your role there?" asks what "what is your role there?" asks.
  const bare = text.replace(QUESTION_LEAD, '');
  return HOUSEKEEPING.some(
    (pattern) => pattern.test(text) || (bare !== text && pattern.test(bare)),
  );
}

// ---------------------------------------------------------------------------------------
// Discovery intent topics

/** Adverbs that add emphasis but not meaning ("what exactly happens" is "what happens"). */
export const FILLER_ADVERBS =
  /\b(?:exactly|actually|specifically|precisely|really|currently|basically|typically|usually|generally|normally|just)\s+/g;

export const INTENT_PATTERNS: Record<DiscoveryIntent, RegExp[]> = {
  problem_description: [
    /\bwhat(?:'s| is| are| has| have)?(?: been)? (?:happening|going on|the (?:issue|problem|trouble|situation)|wrong)\b/,
    /\b(?:tell|walk|talk|take) me (?:a (?:bit|little) )?(?:through|about|more)\b/,
    /\bcan you (?:describe|explain|walk me|(?:tell|give) me (?:a (?:bit|little) )?(?:more|about|what|how|exactly|everything|some (?:detail|background)|the (?:whole|full|story|details|background|situation)|an? (?:example|idea|summary|overview|description)))\b/,
    /\bwhat (?:are|were) you (?:trying|doing|hoping|attempting)\b/,
    /\bwhat you (?:are|were) (?:trying|doing|hoping|attempting)\b/,
    /\bwhat (?:seems|appears) to be\b/,
    /\b(?:describe|explain) (?:the|what|how)\b/,
    /\bwhat (?:happens?|happened) (?:when|if|after|as)\b/,
    /\bwhat (?:is|'s) (?:it|that|this) doing\b/,
    /\bhow (?:does|did) (?:it|this|that) (?:fail|break|go wrong|show up)\b/,
    /\bhow (?:is|does) it (?:behaving|look|work|feel)\b/,
    /\bwhat('?s)? (?:not working|broken|failing)\b/,
    /\bmore (?:detail|details|information|context)\b/,
  ],
  error_message: [
    /\b(?:error|message|code|warning|prompt|alert|notification|wording)\b/,
    /\bwhat (?:does|did|do) (?:it|the (?:screen|page|app|portal|system|site)|that) (?:say|show|display|read|look like)\b/,
    /\bread (?:me|it|that|out)\b/,
    /\b(?:does|did|do) (?:it|the (?:message|error|screen|page|app|portal|system|site)|that) (?:say|show|mention|display|read|give|tell)\b/,
    /\bexact(?:ly)? (?:what|wording|message|text)\b/,
    /\bscreenshot\b/,
    /\bwhat (?:do|did) you (?:see|get)\b/,
    /\bwhat (?:are|were) you (?:seeing|getting)\b/,
    /\bwhat (?:comes|shows) up\b/,
    // "What do your customers see when they pay?" (the subject is someone other than the caller)
    /\bwhat (?:do|does|did|are|were) (?!you\b)(?:your |the |any |all |those |these |each |every )?(?:[a-z-]+ ){0,2}[a-z-]+ (?:see|seeing|get|getting|come up|pop up|appear)\b/,
    // "What does the sign-in page tell you?"
    /\bwhat (?:do|does|did|will|would) (?:the |that |this |your |any )?(?:[a-z-]+ ){0,2}(?:screen|page|message|app|portal|system|site|form|dialog|prompt|window|banner|button|alert|logs?|error|notification|sign-?in|log-?in)(?: [a-z]+)? (?:say|tell|show|display|read|look like|give)\b/,
  ],
  timing_onset: [
    /\bwhen (?:did|was|has|does|do|is|were) (?:it|this|that|the (?:issue|problem)|you)?\s?(?:first |last |actually )?(?:start|begin|began|happen|occur|work|stop|notice|see|appear|change)/,
    /\bwhen (?:it|this|that|the (?:issue|problem)) (?:started|began|first|stopped|happened|broke|last)\b/,
    /\bsince when\b/,
    /\bhow long (?:has|have|ago|is|was|did)\b/,
    /\bwhat time\b/,
    /\b(?:first|last) (?:notice|noticed|time|worked|working|saw|seen)\b(?! (?:you(?:'ve| have)? (?:called|rung|rang|phoned|contacted|spoken|emailed|raised|logged|reported)|calling|contacting|that you (?:call|contact)))/,
    /\b(?:start|started|began|begin) (?:happening|failing|failing|occurring)\b/,
    /\bwhen did you (?:first )?(?:notice|see|start|try)\b/,
    /\bhow long\b/,
    /\bwhen (?:was|did) (?:the )?(?:last|first)\b/,
    /\bwas (?:it|this|that) (?:working|fine|ok|okay|normal) (?:yesterday|before|earlier|last|this)\b/,
    /\bwhen did you (?:last|first)\b/,
    /\b(?:was|did|had) (?:it|this|that|everything) (?:work|working|worked|open|opened|fine|ok|okay|normal)\b/,
    // "When did the failures begin?", "When was it that orders stopped?"
    /\bwhen (?:did|was|were|has|have|do|does) [a-z' -]{1,30}? (?:start|started|begin|began|begun|stop|stopped|fail|failing|failed|break|broke|go wrong|went wrong|happen|happening|appear|show up|kick in)\b/,
    /\bat what (?:point|time|moment|stage)\b/,
  ],
  recent_changes: [
    /\b(?:chang(?:e|ed|es|ing)|updat(?:e|ed|es|ing)|upgrad(?:e|ed|es|ing)|install(?:ed)?|deploy(?:ed|ment)?|migrat(?:e|ed|ion)|reset|reconfigur\w+|modif(?:y|ied)|rolled out|patch(?:ed)?|new (?:setting|policy|config\w*|version|release|process|rule|system))\b/,
    /\banything (?:new|different|else changed|happen|happened)\b/,
    /\bwhat happened (?:before|just before|between|right before)\b/,
    /\bbefore (?:it|this) (?:broke|stopped|started|began)\b/,
    // "Different from the others" compares places, not changes over time, so it is a scope question.
    /\bdifferent(?:ly)?\b(?! (?:from|than) (?:the )?(?:others?|rest|other \w+|everyone|everybody)\b)/,
    // Other ways of asking whether someone touched something: "Has your developer touched the settings?"
    /\b(?:touch|tweak|adjust|edit|alter|releas|push|enabl|disabl|toggl|rotat|renew|replac|swap|renam)(?:ed|ing)\b/,
    /\b(?:shipp(?:ed|ing)|flipp(?:ed|ing)|switch(?:ed|ing) (?:on|off|over|to)|turn(?:ed|ing) (?:on|off))\b/,
    /\banything (?:you|anyone|anybody|someone|somebody|they|he|she|we)\b[^.?!]{0,25}\b(?:before|prior to|right before|recently|lately|beforehand)\b/,
    /\b(?:just|right|shortly|immediately) (?:before|prior to)\b/,
    // "Did anybody release or alter anything?", "Has someone touched the settings?"
    /\b(?:did|has|have|had) (?:anyone|anybody|someone|somebody|you|your \w+|the \w+|they|he|she|we|everyone)(?: else)?(?: (?:on|at|in|within|from) (?:your|the) \w+)? (?:recently |also |possibly )?(?:touch|tweak|adjust|edit|alter|releas|push|enabl|disabl|toggl|rotat|renew|replac|swap|renam|ship|flip|switch|turn|reorgani[sz])\w*/,
    /\bbefore (?:it|this|that|the [a-z-]+(?: [a-z-]+)?) (?:broke|stopped|started|began|failed|went wrong)\b/,
  ],
  affected_scope: [
    /\bhow many (?:people|users|staff|colleagues|team|machines|devices|locations|sites|offices|customers|accounts|of you)\b/,
    /\bwho (?:else|is|are) (?:affected|impacted|seeing|having|experiencing|able|unable)\b/,
    /\b(?:just|only) (?:you|your (?:account|laptop|computer|device|machine))\b/,
    // "Is it only the three of you?", "Is it just a couple of people?"
    /\b(?:just|only) (?:the )?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few|a couple of|several|some) (?:of )?(?:you|them|us|people|users|colleagues|staff|accounts|devices|machines)\b/,
    /\beveryone\b/,
    /\b(?:anyone|anybody|someone|somebody) else\b/,
    /\b(?:other|another) (?:users|people|colleagues|team ?members|staff|accounts)\b/,
    /\bwhich (?:users|people|teams|locations|sites|offices|regions|accounts)\b/,
    /\bhow (?:widespread|many)\b/,
    /\b(?:affected|impacted)\b/,
    /\bis (?:it|this) (?:happening|affecting) (?:to|for) (?:anyone|others|everyone|your team)\b/,
    /\bsame (?:problem|issue)\b/,
    // Yes/no questions about who else is affected: "Can anyone still open it?", "Is the whole team locked out?"
    /\b(?:can|could|does|do|is|are|was|were) (?:anyone|anybody|someone|somebody|everyone|everybody|others|other (?:people|colleagues|members|users)|any of (?:you|your|them|the)|all of (?:you|your|them)|the (?:whole|entire|rest of the) (?:team|office|company|department|group))\b/,
    /\bwhich of (?:you|your|the|them)\b/,
    /\bwho (?:can|could|has|have|is able|are able|still)\b/,
    // Not "Have you spoken to anyone about this?": that is about who the customer has contacted.
    /(?<!\b(?:spoken|talked|spoke|talk|speak|speaking|written|wrote|reported|called|phoned|emailed|email|told|tell|escalated|complained|mentioned|reached out) )\b(?:for|to) (?:anyone|anybody|everyone|everybody|others)\b/,
    // How far the problem reaches beyond the one thing: "Is it only this workspace?", "Is email working?"
    /\b(?:only|just) (?:this|that|the|one) (?:workspace|app|application|site|system|service|tool|page|file|folder|portal|account|project)\b/,
    /\bother (?:tools|apps|applications|sites|systems|services|features|files|folders|workspaces|projects)\b/,
    /\b(?:is|are) (?:your )?(?:email|e-mail|internet|everything else|the rest) (?:working|fine|okay|ok)\b/,
    // "Is the Australian store behaving differently from the others?", "Is it every region or just one?"
    /\b(?:store|storefront|shop|region|site|office|branch|location|market|country|team|group|department|server|cluster)s?\b[^.?!]{0,45}\b(?:affected|impacted|unaffected|still (?:working|up|running|taking|processing|fine|ok|okay)|differently|the others|the rest|any other)\b/,
    /\b(?:every|each|all|any|some|only|just|one) (?:of (?:the |your )|your )?(?:region|store|storefront|shop|location|site|office|market|country|branch|environment|server|tenant)s?\b/,
    /\b(?:all|every|just|only|some) (?:of (?:your|the) )?(?:customers|users|shoppers|visitors|clients|orders|payments|transactions|checkouts|devices|machines)\b/,
  ],
  business_impact: [
    /\b(?:impacts?|impacting|effects?|consequences?|knock-on)\b/,
    /\bhow (?:urgent|critical|serious|bad|important|much of a)\b/,
    /\bwhat does (?:this|that|it) mean for\b/,
    /\b(?:blocking|stopping|preventing|holding up|disrupting) (?:you|your|the|anything|anyone|work)\b/,
    /\bhow is (?:this|it) (?:affecting|impacting|hurting)\b/,
    /\bwhat (?:can't|cannot|can not) you (?:do|do now)\b/,
    /\b(?:business|operations|revenue|customers|patients|bookings|orders) (?:impact|affected|are|is|can)\b/,
    /\b(?:depends?|depending|rel(?:y|ies|ying)) (?:on|upon)\b/,
    /\b(?:client|customer|stakeholder|boss|manager|board|investor)s? (?:is|are|expect\w*|waiting|need\w*|want\w*|chasing)\b/,
    // "How much revenue do you lose for each hour this is down?"
    /\bhow much (?:revenue|money|income|business|trade|sales|work|productivity)\b[^.?!]{0,40}\b(?:lose|losing|lost|loss|at risk|costing|cost|costs|affected|impacted)\b/,
    /\b(?:revenue|sales|orders|income|transactions|money|business) (?:per|an|each|every|a) (?:hour|minute|day)\b/,
    /\bhow many (?:orders|sales|transactions|bookings|customers|patients|payments|checkouts)\b[^.?!]{0,40}\b(?:lose|losing|lost|missed|miss|missing|failing|failed|blocked|affected)\b/,
  ],
  workaround: [
    /\bwork ?around\b/,
    /\b(?:alternative|other way|another way|any way (?:to|you))\b/,
    /\bcan you (?:still|otherwise|use|do)\b/,
    /\bdoes (?:it|that|this) (?:work|happen|fail|occur) (?:on|for|if|when|in|with)\b/,
    /\b(?:other|another|different) (?:browser|device|computer|laptop|account|user|location|network|machine)\b/,
    /\bworks? for (?:some|anyone|others|him|her|them|anybody)\b/,
    /\bin the meantime\b/,
    /\btemporary (?:fix|solution|way)\b/,
    // Undoing or restoring: "Is it possible to roll that change back?", "Could you revert to the previous setup?"
    /\broll(?:ing|ed)?\b[^.?!]{0,25}\bback\b|\brollback\b|\brevert(?:ed|ing)?\b|\brevers(?:e|ed|ing|al)\b|\bundo(?:ing)?\b|\bback(?:ing)? (?:it|that|this|those|them|the \w+) out\b|\bback out\b/,
    /\b(?:restor(?:e|ing)|go(?:ing)? back to|return(?:ing)? to|switch(?:ing)? back to) (?:the |a |your )?(?:previous|prior|last|old|earlier|original|working|known|stable)\b/,
    /\b(?:is|are) there (?:a|any|some) (?:way|option|alternative|means)\b/,
    // A stop-gap copy of the work: "Does anyone have a saved copy you could work from?"
    /\b(?:saved|offline|local|backup|cached|older|spare) (?:cop(?:y|ies)|version)\b|\bcopy of (?:the|your|those|that) (?:files?|folders?|reports?|documents?|data|work)\b/,
  ],
  already_tried: [
    /\bwhat (?:have|has|did|had) you (?:tried|try|done|do|attempted)\b/,
    /\bhave you (?:tried|already|attempted|done)\b/,
    /\bdid you (?:try|already|attempt)\b/,
    /\banything (?:you've|you have|else you've) (?:tried|done|attempted)\b/,
    /\bwhat (?:steps|things|else) (?:have|did) you\b/,
    // Asking whether the customer has been in touch with support is a question about the case, not
    // about what they have tried.
    /\bhave you (?:asked|checked with|spoken|talked|contacted|told|reached out|messaged|emailed|called)\b(?! (?:to |with )?(?:us|support|microsoft|our (?:team|support|help ?desk))\b)/,
    /\b(?:tried|attempted) (?:to|any|anything|so far)\b/,
    /\bso far\b/,
    // "Have you looked at the status page?", "Have you or a colleague had a go at resetting it?"
    /\bhave you(?: or [^?.!,]{1,25}?)? (?:looked|checked|reviewed|searched|read|consulted|gone through|been through|compared|confirmed|tested|rebooted|restarted|cleared|reinstalled|had a (?:go|look|try|crack)|taken a look)\b/,
    /\bwhat (?:have|has|did|had) (?:you|they|he|she|your \w+)\b[^.?!]{0,30}\b(?:tried|try|done|attempted|attempt)\b/,
    /\b(?:has|have|had) (?:anyone|anybody|someone|somebody|your \w+|the \w+)(?: else)? (?:looked|checked|tried|reviewed|had a (?:go|look)|taken a look|investigated|confirmed)\b/,
  ],
  environment: [
    /\b(?:browser|device|computer|laptop|desktop|phone|mobile|tablet|operating system|windows|mac(?:book)?|linux|android|ios|iphone|version|network|wi-?fi|vpn|office|remote|location|environment|application|software|program)\b/,
    /\bwhich (?:app|application|platform|browser|device|version|system|environment|region|site|computer|software|program|tool|service)\b/,
    /\bwhat (?:are you|do you|kind of|type of|sort of) (?:using|use|running|working on)\b/,
    /\bwhere are you (?:working|calling|located|connecting)\b/,
    /\b(?:signed|logged) in (?:on|to|anywhere|elsewhere|from)\b/,
    /\b(?:other|another) devices?\b/,
    /\bmail app|email app\b/,
    /\byour (?:setup|set-up|configuration|machine|equipment)\b/,
  ],
  reproducibility: [
    /\b(?:every time|each time|always|sometimes|intermittent(?:ly)?|how often|how frequently|reproduce|repeatable|consistent(?:ly)?|pattern)\b/,
    /\bsteps (?:to|you|that)\b/,
    /\bonly when\b/,
    /\bdoes (?:it|this) (?:happen|fail) (?:every|each|all|always)\b/,
    /\bcan you (?:make it|get it to) (?:happen|fail)\b/,
    /\bwhat (?:are|were) you doing when\b/,
    /\bsame (?:thing|result|error|behaviour|behavior)\b/,
    /\b(?:has|have) (?:this|it|that) (?:happened|occurred|been happening) before\b/,
    /\b(?:happened|occurred) before\b/,
  ],
  previous_contact: [
    /\b(?:previous(?:ly)?|earlier|last time|prior|before) (?:call|contact|case|ticket|time|conversation|advice|support)\b/,
    /\b(?:case|ticket|reference) (?:number|id|history|notes)\b/,
    // "Is this about an existing case?", "Do you already have a ticket open?"
    /\b(?:existing|open|ongoing|current) (?:case|ticket|incident)\b/,
    /\b(?:already|currently) (?:have|got|opened|raised|logged) (?:an? |the )?(?:case|ticket|incident)\b/,
    /\b(?:is|was) (?:this|it|that) (?:about|related to|linked to|connected to|part of|regarding) (?:an? |the |your )?(?:existing|earlier|previous|prior|open|ongoing|same) (?:case|ticket|incident|call|contact|issue|problem)\b/,
    /\bfirst time (?:you(?:'ve| have)|you're|you are|calling|contacting|that you)\b/,
    /\b(?:contacted|called|spoke to|raised|logged|reported|emailed) (?:support|us|anyone|someone|it)\b/,
    /\b(?:spoken|talked|spoke|talk) to (?:anyone|someone|anybody|somebody|support|it)\b/,
    /\bwhat (?:were|was) you told\b/,
    /\bwho did you (?:speak|talk)\b/,
    /\b(?:you(?:'ve| have)(?: already)? been told|(?:were|was) you (?:ever |already )?told|been told by (?:us|support|our|the (?:support|chat|help|service) \w+)|already (?:raised|logged|reported|contacted|spoken))\b/,
    // Case or contact history, not "change history" or "billing history".
    /\b(?:case|ticket|contact|support|call|conversation|chat) history\b|\bhistory (?:with|of) (?:us|support|contact|calls|cases|tickets)\b/,
    // "What have you been told so far?", "What did the chat team say?"
    /\bwhat (?:have|has|had|were|was|did|do) (?:you|our [a-z]+|the (?:support|chat|help|service|sales|account) \w+)(?: been)? (?:told|said|say|tell you|advised|suggested|recommended)\b/,
  ],
  urgency_deadline: [
    /\bdeadline\b/,
    /\bby when\b/,
    /\bhow soon\b/,
    /\bwhen do you (?:need|want|expect|have to)\b/,
    /\btime ?(?:line|frame|scale|pressure)\b/,
    /\b(?:urgent|urgency)\b/,
    /\bneed (?:it|this) (?:by|before|fixed|working|back)\b/,
    /\bwhat(?:'s| is) the (?:rush|hurry|time)\b/,
  ],
  expected_outcome: [
    /\bwhat (?:would|do|did) you (?:like|want|need|expect|hope)\b/,
    /\b(?:outcome|goal|objective|resolution|result)\b/,
    /\bwhat (?:are|were) you (?:trying|hoping|looking) (?:to|for)\b/,
    /\bwhat does (?:success|good|resolved|fixed) look like\b/,
    /\bideal(?:ly)?\b/,
    /\bwhat (?:should|would) happen\b/,
  ],
  account_details: [
    /\b(?:account|licen[cs]e|plan|subscription|role|permission|access level|username|user ?name|user id|admin|assigned|seat|tier|billing|invoice|contract|group|membership)\b/,
    /\bwho (?:manages|owns|administers|set up|created)\b/,
    /\b(?:owner|owners|administrator|administrators)\b/,
  ],
};

// ---------------------------------------------------------------------------------------
// Behaviours

export const GREETING =
  /\b(?:hello|hi|hey|good (?:morning|afternoon|evening)|thanks? for (?:calling|contacting|reaching)|thank you for (?:calling|contacting|reaching|getting in touch))\b/;
export const SELF_INTRO =
  /\b(?:my name is|this is [a-z]+|i'?m [a-z]+ (?:from|with|at|on the)|my name'?s|you'?ve (?:reached|got)|speaking with|i'?ll be (?:helping|looking after|your))\b/;
export const OFFERS_HELP =
  /\b(?:how (?:can|may|could) i (?:help|assist)|what can i do for you|happy to help|here to help|i can help|glad to help|i'?d be happy to|let me help|how can we help)\b/;

export const EMPATHY_GENERIC =
  /\b(?:sorry (?:to hear|about|for|that)|i'?m sorry|i am sorry|apolog(?:y|ies|ise|ize)|i (?:completely |totally |fully )?understand|i (?:can )?(?:see|hear|appreciate|imagine) (?:that|how|why|what)|that (?:sounds|must be|is|must have been|would be) (?:really |very |so |quite )?(?:frustrating|stressful|difficult|hard|annoying|worrying|upsetting|inconvenient|tough|worrisome|disruptive)|thank(?:s| you) for (?:your )?(?:patience|waiting|bearing with|explaining|letting me know|sharing|telling me)|i (?:completely |totally )?get (?:it|that|why)|must be (?:frustrating|stressful|difficult|hard|worrying))\b/;
export const EMPATHY_SPECIFIC_FRAME =
  /\b(?:especially|particularly|given (?:that|the|your)|with (?:the|your)|when you|since you|because you|you'?ve been|you can'?t|you cannot|you are (?:unable|stuck)|your (?:team|patients|customers|day|morning|deadline|bookings|orders|work|event|launch|clients|staff))\b/;

export const IMPACT_ACK: RegExp[] = [
  /\b(?:understand|see|appreciate|realise|realize|know|hear|get) (?:how |that |why )?(?:this|that|it)(?:'s| is| must be| sounds| has been)? ?(?:really |very |clearly |extremely )?(?:urgent|critical|important|serious|stressful|a big deal|a priority|affecting|impacting|blocking|holding|disrupting)\b/,
  /\b(?:affecting|impacting|blocking|holding up|disrupting|stopping) (?:your|the) (?:team|business|work|customers|patients|operations|orders|bookings|day|deadline|launch|event|morning|staff|clients|checkout|site|service)\b/,
  /\b(?:your|the) (?:team|business|customers|patients|operations|deadline|launch|event|orders|bookings|staff|clients|checkout) (?:can'?t|cannot|are (?:unable|stuck|waiting)|is (?:unable|stuck|waiting)|depend)\b/,
  /\b(?:treat|treating|treated) (?:this|it) (?:as )?(?:a |an )?(?:priority|urgent|high priority|top priority)\b/,
  /\b(?:this|that|it)(?:'s| is) (?:clearly |obviously )?(?:urgent|critical|a priority|a big deal|serious|important to you)\b/,
  /\b(?:i |we )?(?:fully |completely |really )?(?<!\bto )(?:realise|realize|understand|appreciate) (?:the|your) (?:deadline|time pressure|urgency|stakes|impact|situation)\b/,
  /\bthat'?s (?:a lot|a big|a real) (?:to deal with|problem|concern|pressure)\b/,
  // The trainee names the stakes in their own words: "I realise the CEO is presenting at eleven",
  // "I know your whole business runs through that checkout", "I appreciate you can't take any sales".
  /\b(?:i|we)(?:'m| am)? (?:(?:well|fully|completely|totally|really|truly|do|can|definitely) )*(?:realise|realize|understand|appreciate|know|see|recognise|recognize|get|hear|tell|aware)\b[^.?!]{0,70}\b(?:time-?critical|urgent\w*|deadline|presenting|presentation|investors?|ceo|every (?:minute|hour|second)|(?:costing|losing|lose|lost) (?:you )?(?:orders|sales|money|revenue|customers|business)|(?:can'?t|cannot|unable to) (?:take|process|accept|sell|serve|trade)|business (?:runs|relies|depends)|(?:runs|relies|depends) (?:on|through)|riding on|at stake|on the line|(?:whole|entire) (?:business|company|team|operation))\b/,
  /\bevery (?:minute|hour|second) (?:counts|matters)\b/,
  /\b(?:hurting|hitting|costing|damaging) (?:your|the) (?:sales|revenue|orders|business|income|trade|bookings|customers)\b/,
];

export const OWNERSHIP_CLEAR =
  /\b(?:i(?:'ll| will| am going to|'m going to|'m gonna) (?:take (?:ownership|this on|care of this|charge)|own this|own it|look after this|see this through|stay (?:on|with) (?:this|it|you)|stick with (?:this|it|you)|be (?:your|the) (?:point of contact|owner|contact)|personally (?:look|handle|follow|take|make sure|check)|follow (?:this|it) (?:up|through)|make sure (?:this|it|that)|work on this|get (?:this|it) (?:sorted|resolved|fixed|moving|escalated)|escalate (?:this|it)|chase|drive this|raise (?:this|it))|(?:and|then) (?:i(?:'ll| will) )?(?:stay|stick) (?:on|with) (?:this|it|you|the case)|until (?:it(?:'s| is)|this is) (?:fixed|resolved|sorted|done)|i'?ve got (?:this|it)|this is (?:my|mine)|(?:my|mine) (?:case|priority|responsibility)|(?:i|we)(?:'ll| will) (?:make sure|ensure|see this through)|i'?m (?:responsible|on it|taking)|leave (?:it|this) with me|i can take (?:that|this|it)|i'?ll (?:take|handle) (?:that|this|it))\b/;
// Promising to do something that moves the customer's problem forward is taking it on, even
// without the word "ownership": "I'll get the account unlocked", "I'm going to get an engineer on
// this", "I'll sort this out for you". Looking into something is not enough, and neither is
// logging in or opening a page, so the verbs here are about outcomes.
export const OWNERSHIP_ACTION =
  /\bi(?:'ll| will|'m going to| am going to|'m gonna) (?:(?:now|just|go ahead and|straight away|right away|personally) )*(?:(?:unlock|reset|fix|restore|resolve|reinstate|reactivate|re-?enable|correct|repair|re-?issue|refund|escalate|expedite|arrange|organi[sz]e|sort)\b(?: (?:this|it|that|the \w+|your \w+))?(?: out)?|get (?:an? |the |our |some )?(?:engineers?|specialists?|developers?|team|colleagues?|manager|someone)\b[^.?!]{0,20}\b(?:on|to|involved|looking|working|help|fix)\b|get (?:the|your|this|it|that|everything)\b[^.?!]{0,25}?\b(?:unlocked|fixed|sorted|resolved|restored|reset|working|back|running|unblocked|reactivated|enabled|assigned|updated|corrected|raised|escalated|moving)\b|raise (?:this|it|that)\b|log (?:a|this|it) (?:case|ticket|incident|request|issue|fault)\b)/;
export const OWNERSHIP_VAGUE =
  /\b(?:(?:we|i)(?:'ll| will| can| might| could) (?:look|see (?:what|if|whether|about|how|to)|try|check|have a look|take a look|investigate|get back)|someone (?:will|should|can|might)|let me (?:see|check|look|try)|i'?ll (?:try|see)|hopefully|we should be able|i think we can|bear with me|(?:the|our) team (?:will|should))\b/;

const TIME_PHRASE =
  /\b(?:(?:by|before|within|in|at|after|until|around) (?:the )?(?:end of (?:the )?(?:day|today|business|week)|eod|tomorrow|today|tonight|noon|midday|\d{1,2}(?::\d{2})?\s?(?:am|pm)?|\d+ ?(?:minutes?|mins?|hours?|hrs?|days?)|the next (?:hour|day|few hours|\d+)|(?:mon|tues|wednes|thurs|fri|satur|sun)day|this (?:morning|afternoon|evening))|next update|(?:call|email|update|contact|ring|message|check in with|get back to) you (?:back )?(?:at|by|in|within|before|tomorrow|today|this)|tomorrow (?:morning|afternoon)|\d{1,2}(?::\d{2})? ?(?:am|pm))\b/;
export const ACTION_COMMIT =
  /\b(?:(?:i(?:'ll| will| am going to|'m going to)|we(?:'ll| will)) (?:call|phone|text|ping|buzz|email|update|contact|ring|message|check|review|investigate|send|escalate|raise|look|follow|arrange|schedule|get|come back|be back|be in touch|report back|reach out|circle back|check back|touch base|speak|have|let|confirm|test|restore|unlock|reset)|(?:expect|you(?:'ll| will) (?:get|receive|hear)) (?:an? )?(?:update|call|email|message|reply|response|word|call ?back))\b/;
// A callback at a stated time is itself a committed next step, even in "I'll take this on and call you back at 2pm".
export const CALLBACK_WITH_TIME =
  /\b(?:call|phone|text|ping|buzz|email|update|contact|ring|message|check in with) you (?:back )?(?:(?:at|by|in|within|before|tomorrow|today|this|on|every|each)\b|daily|hourly|twice a day)/;
export const NEXT_STEPS_VAGUE =
  /\b(?:get back to you|follow up|be in touch|let you know|update you|keep you (?:posted|updated|in the loop)|(?:call|phone|ring|email|message|text|contact|ping) you (?:back|later|again)|circle back|check back|shortly|soon|as soon as (?:possible|i can)|asap|in due course|sometime)\b/;

// Durations people say aloud, which the numeric pattern above does not cover: "in half an hour",
// "within a couple of hours", "in twenty minutes", "by ten o'clock".
const TIME_PHRASE_SPOKEN =
  /\b(?:(?:in|within|after|around|for the next) (?:about |roughly |around |just |only )?(?:half an hour|half hour|an hour|a quarter of an hour|a (?:couple|few) (?:of )?(?:minutes|hours)|(?:one|two|three|four|five|six|ten|fifteen|twenty|thirty|forty-?five|sixty) (?:minutes?|mins?|hours?|hrs?))|within the (?:hour|day)|(?:by|before) (?:lunch ?time|close of business|cob|close of play|end of play)|(?:at|by|around|before|until) (?:(?:quarter|half) (?:past|to) (?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (?:o'?clock|am|pm|fifteen|thirty|forty-?five))|(?:every|each) (?:(?:\d+|one|two|three|four|five|six|ten|few|other|couple of|half) )?(?:minutes?|hours?|days?|mornings?|afternoons?|evenings?)|hourly|daily|twice a day)\b/;

function hasTimePhrase(sentence: string): boolean {
  return TIME_PHRASE.test(sentence) || TIME_PHRASE_SPOKEN.test(sentence);
}

export function hasSpecificNextSteps(sentence: string): boolean {
  return (
    hasTimePhrase(sentence) &&
    (ACTION_COMMIT.test(sentence) ||
      CALLBACK_WITH_TIME.test(sentence) ||
      /\bnext update\b/.test(sentence))
  );
}
export const NEXT_CONTACT =
  /\b(?:next (?:update|contact|call|step|check ?in)|follow ?up|call (?:you )?back|speak (?:again )?(?:at|by|tomorrow|today)|touch base|i(?:'ll| will) (?:call|phone|text|ping|email|update|contact|ring|message|check in with) you (?:at|by|in|on|tomorrow|today|this))\b/;

export const PROMISE_REALISTIC =
  /\b(?:(?:can'?t|cannot|can not|won'?t|not (?:able|going) to|don'?t want to|unable to|wouldn'?t want to) (?:promise|guarantee|commit)|(?:i|we) (?:can|will) commit to|what i can (?:promise|commit to|do is)|i don'?t want to (?:over ?promise|give you a (?:time|date) i can'?t))\b/;
const RESOLUTION_WORD =
  /\b(?:fixed|resolved|sorted|working (?:again|by)|back (?:up|online|to normal)|restored|solved|up and running|live again)\b/;
export const PROMISE_UNVERIFIED_PHRASE =
  /\b(?:i (?:can )?(?:promise|guarantee|assure you)|(?:it|this|that)(?:'ll| will| should) (?:definitely|certainly|absolutely)?\s?(?:be )?(?:fixed|resolved|working|sorted|back)|(?:we|i)(?:'ll| will) (?:definitely|certainly|absolutely) (?:fix|resolve|solve|sort)|no (?:problem|worries),? (?:it|this)(?:'ll| will) be)\b/;

// "I'll check whether it is fixed" asks about an outcome; it does not promise one.
const OUTCOME_CHECK = /\b(?:whether|if)\b[^.?!,;]{0,40}/g;

export function isUnverifiedPromise(sentence: string): boolean {
  if (PROMISE_REALISTIC.test(sentence)) return false;
  if (PROMISE_UNVERIFIED_PHRASE.test(sentence)) return true;
  return (
    RESOLUTION_WORD.test(sentence.replace(OUTCOME_CHECK, ' ')) &&
    hasTimePhrase(sentence) &&
    /\b(?:will|'ll|should|going to)\b/.test(sentence) &&
    !/\bupdate\b/.test(sentence)
  );
}

// Blame. "You should have restarted it" scolds. "You shouldn't have to chase us", "you must have been
// waiting a long time" and "you were supposed to hear from us" use the same words to take the
// customer's side, so a modal form is blame only when it is about something the customer did. (Kept
// in step with the care lexicon the evaluator reads tone with; the engine may not import it.)
const OWED = String.raw`(?:(?:heard|received|got|gotten)|had (?:an? |some |any |more |better |the )?(?:update|call|callback|call back|reply|response|answer|email|message|confirmation|news|help|support|apology|follow-up|resolution|reminder)s?|been (?:told|given|sent|contacted|called|updated|notified|informed|offered|provided|kept|helped|answered|looked after))`;
const OWED_TO_BE = String.raw`(?:receive|get|hear|have (?:received|heard|been|had|got)|be (?:contacted|called|told|sent|given|updated|notified|informed|offered|provided|helped))`;
const WENT_WRONG = String.raw`(?:clicked|pressed|changed|deleted|typed|entered|selected|installed|removed|disabled|turned|set|configured|misconfigured|done|missed|forgotten|ignored|skipped|broken|messed|mistyped|overlooked|accidentally|made (?:an? )?(?:mistake|error|typo))`;

/** Blame that nobody says kindly. */
export const BLAME_CLEAR =
  /\b(?:you (?:need to (?:read|follow|make sure|be more)|failed to|forgot to|probably (?:did|didn'?t|forgot))|(?:your|the customer'?s?) (?:fault|mistake|error|responsibility)|user error|that'?s (?:on you|your (?:side|end|problem|responsibility))|(?:not|isn'?t) (?:our|my) (?:problem|fault|issue|responsibility)|(?:another|other|a different|the) (?:team|department|vendor|provider) (?:is|are|was|were) (?:responsible|to blame|at fault)|(?:it'?s|that'?s) (?:a |an )?(?:network|your network|internal|your it) (?:issue|problem)|you (?:didn'?t|did not) (?:follow|read|tell|check|make sure))\b/;

/** Blame that can also be sympathy, as long as it is about something the customer did. */
export const BLAME_MODAL = new RegExp(
  String.raw`\byou (?:should have\b(?! ${OWED}\b)|shouldn'?t have\b(?! (?:to|had|needed|been)\b)|were supposed to\b(?! ${OWED_TO_BE}\b)|must have ${WENT_WRONG}\b)`,
);

/** Either kind of blame: the words alone, before the rest of the sentence is weighed. */
export const BLAME = new RegExp(`${BLAME_CLEAR.source}|${BLAME_MODAL.source}`);

const TAKEN_BACK = /\b(?:but|however|although|though)\b/;

/**
 * Whether a statement puts the fault on the customer. "I'm sorry, you shouldn't have gone through
 * all that" holds the words of blame and takes the customer's side: a modal form that comes with an
 * apology or sympathy the sentence does not take back with a "but" is kindness.
 */
export function blames(lower: string): boolean {
  if (BLAME_CLEAR.test(lower)) return true;
  return BLAME_MODAL.test(lower) && !(EMPATHY_GENERIC.test(lower) && !TAKEN_BACK.test(lower));
}

/** The engineer is playing back what they understood: "So to confirm, you changed your password." */
export const RECAP_LEAD =
  /^(?:and |ok(?:ay)?,? |right,? )?(?:so\b|just to (?:confirm|check|clarify|recap|summari[sz]e)|to (?:confirm|recap|summari[sz]e|clarify|check)|let me (?:just )?(?:confirm|recap|summari[sz]e|check|repeat)|if i(?:'ve| have) (?:understood|got)|what i(?:'ve| have) understood|as i understand)/;

// "As I said" recalls what was said, and "I'll ring at 3 as I said" keeps a promise, so only the
// scolding forms are held against the engineer: "as I already told you", "I already told you".
export const DISMISSIVE =
  /\b(?:calm down|don'?t worry about it|no (?:big|great) deal|it'?s (?:just|only|simply) (?:a |an )?(?:minor|small|simple|little)|that'?s not (?:a |that |really )?(?:big|major|serious|an issue|a problem|an emergency)|(?:you'?re|you are) (?:over ?reacting|exaggerating)|that (?:shouldn'?t|can'?t|cannot|doesn'?t) (?:be|happen|possible|work that way)|(?:that'?s|it'?s) (?:impossible|not possible)|there'?s nothing (?:i|we) can (?:do|say)|that'?s (?:just|simply) how it (?:works|is)|as i (?:already|have already|just) (?:said|told you|explained)|like i (?:already|just) (?:said|told you)|i (?:already|have already|just) (?:told|explained|said)(?: (?:it|this|that))?(?: to)? you)\b/;

/**
 * Impatience with the customer, in a statement: an order to answer, or the whole sentence a brush-off.
 * Never a question: "Could you just tell me what the screen says?" is polite.
 */
export const IMPATIENT_STATEMENT =
  /\bjust (?:tell me|answer)\b|^(?:(?:oh|ok(?:ay)?),? )?whatever\W*$/;

// More ways of putting the fault on the customer, in everyday words ("a problem on your side",
// "your developer broke it", "that's not something we did"). Statements only: the classifier does
// not apply them to questions. Hedged wording ("could be", "if") is left alone.
export const BLAME_MORE: RegExp[] = [
  /^(?!.*\b(?:could|might|may be|maybe|perhaps|possibly|not sure|unsure|wondering|if)\b).*\b(?:problem|issue|fault|cause|bug|error|mistake|failure|outage)\b[^.?!]{0,40}\b(?:on|at|with|in|from) your (?:side|end|network|set-?up|config\w*|systems?|code|site|servers?|infrastructure)\b/,
  /\b(?:you|your (?:team|developers?|devs?|admins?|engineers?|staff|colleagues?|people|it (?:team|department)))(?:'s)? (?:broke|caused|changed|misconfigured|mis-?configured|messed (?:it |this |that )?up|screwed (?:it |this |that )?up|got (?:it|this|that) wrong|did (?:this|that|it)|made (?:a |the )?(?:mistake|error|change))\b/,
  /^(?!.*\b(?:could|might|may be|maybe|perhaps|possibly|not sure|unsure|wondering|if)\b).*\b(?:it'?s|that'?s|this is|this was|that was) (?:your|the customer'?s?) (?:team'?s? |developer'?s? |admin'?s? )?(?:change|config\w*|set-?up|code|settings?|doing|release|deployment)\b/,
  /^(?!.*\b(?:could|might|may be|maybe|perhaps|possibly|not sure|unsure|wondering|if)\b).*\bcaused by (?:you|your|the customer)\b/,
  /^(?!.*\b(?:could|might|may be|maybe|perhaps|possibly|not sure|unsure|wondering|if)\b).*\b(?:down to|due to|because of|a result of|thanks to) (?:you|your (?:team|developers?|devs?|admins?|engineers?|staff|colleagues?|people|set-?up|config\w*|changes?|settings?|code|network|mistake|error|release|deployment))\b/,
  /\byou (?:really |definitely |clearly |obviously )?(?:should|ought to|needed to) have (?:tested|checked|read|told|known|backed|followed|asked|planned|warned|made sure|kept|saved|noticed|spotted|been more careful)\b/,
  /\bif you(?:'d| had) (?:only |just )?(?:tested|checked|read|told|known|backed|followed|asked|planned|warned|made sure|kept|saved|noticed|spotted|been more careful)\b/,
  /\byou(?:'ve| have|'d| had)? (?:configured|set|entered|typed|put|done|used|clicked|installed|deployed|pushed|applied|set up|filled)\b[^.?!]{0,40}\b(?:wrong|incorrectly|badly|improperly)\b/,
  /\b(?:that'?s|this is|it'?s) not (?:something )?(?:we|i|our|my) (?:did|caused|broke|changed|control|are responsible for)\b/,
  /\byou(?:'ll| will)? (?:need|have|want) to (?:look at|check|fix|sort(?: it| this| that)? out|deal with|investigate|resolve) (?:your own|it yourself|this yourself|that yourself|things yourself|yourselves)\b/,
];

// More ways of brushing off the customer's concern ("don't worry, it's probably just a glitch",
// "it's not that big of a deal", "relax"). Plain reassurance such as "don't worry, I'll look into
// it" is not matched.
export const DISMISSIVE_MORE: RegExp[] = [
  /\bdon'?t (?:worry|stress|panic|fret|sweat)\b[^.?!]{0,12}\b(?:it'?s|its|that'?s|this is|it is)\b[^.?!]{0,30}\b(?:just|only|probably|nothing|minor|small|simple|silly|common|normal|glitch)\b/,
  /\b(?:i|we) wouldn'?t (?:stress|worry|panic|fret|get (?:upset|worked up)) (?:about|over)\b/,
  /\b(?:it'?s|that'?s|this is)\b[^.?!]{0,25}\bnot (?:that |such |really |much )?(?:a )?(?:big|major|serious|huge|great|real)(?: of)?(?: a)? (?:deal|issue|problem|thing|emergency|crisis|worry|concern)\b/,
  /\bnot the end of the world\b/,
  /(?:^|[,;:] ?)(?:just |please |try to )?(?:relax|chill out|settle down|take it easy)\b/,
  /\bnothing (?:to|for you to) (?:worry|be (?:upset|angry|worried|concerned|alarmed|anxious)|stress|panic|get (?:upset|worked up))/,
  /\byou (?:don'?t|do not) (?:need|have) to (?:be |get )?(?:so |that |too )?(?:worried|upset|angry|stressed|anxious|concerned|panicked|alarmed|worry|stress|panic)\b/,
  /\byou(?:'re| are) (?:making|causing|creating) (?:a |such a )?(?:bit of a |big |huge )?(?:fuss|scene|drama|big deal|mountain out of a molehill)\b/,
  /\b(?:it|this|that|these things|things like this|problems like this) (?:usually|often|generally|normally|always|just) (?:sort|resolve|fix|clear|work)s? (?:themselves|itself) out\b/,
  /\b(?:it'?s|that'?s|this is|it is)\b[^.?!]{0,25}\b(?:just|only|simply|merely)\b[^.?!]{0,15}\b(?:glitch|blip|hiccup)\b/,
];

export const SUMMARISES =
  /\b(?:(?:so|ok(?:ay)?|right|alright),? (?:just )?to (?:summaris|summariz|recap|confirm|make sure|check|clarify)\w*|let me (?:just )?(?:summaris|summariz|recap|repeat|play (?:it|that) back|confirm|make sure i)\w*|to (?:summaris|summariz|recap)\w*|if i(?:'ve| have)? (?:understood|got (?:this|that|it)|heard)|what i(?:'m| am) (?:hearing|understanding)|my understanding is|do i have (?:that|this|it) right|is that (?:right|correct|accurate|fair)|have i (?:got|understood)|so (?:what|if) you'?re saying|so (?:you|it)(?:'re| are| is| was| started|'s| have| had)|sounds like (?:you|it|the)|so (?:basically|essentially)|just so i(?:'m| am) (?:clear|sure|following))\b/;

export const WRAPS_UP =
  /\b(?:to (?:summaris|summariz|recap|wrap up)\w*|in summary|before (?:we|you) (?:go|finish|end|hang up)|let me (?:just )?(?:confirm|recap|summarise|summarize) (?:what|the|where)|(?:we'?ve|i'?ve) (?:covered|agreed|decided)|what we'?ve agreed|here'?s (?:what|where) (?:we|i)(?:'ve| have)|that'?s (?:everything|all) (?:i|we)|we'?re (?:all )?(?:set|done|good))\b/;
// Asking whether the customer needs anything else. Agreement check-ins such as "does that work?"
// are not closing behaviour on their own, so they are deliberately not matched here.
export const ANYTHING_ELSE =
  /\b(?:anything else|is there anything (?:else|more|further|other|i can|we can|you(?:'d| would) like)|any (?:other|further) (?:questions|issues|concerns|problems)|have i (?:answered|covered)|any questions)\b/;
export const THANKS_CLOSE =
  /\b(?:thank(?:s| you)(?: (?:so much|very much|for (?:your time|calling|your patience|bearing)))?|have a (?:good|great|nice|lovely)|take care|good ?bye|bye(?: for now)?|speak (?:to you )?soon)\b/;
// Saying goodbye. A thank you alone is not one (it comes all through a call), and neither is "until
// then", "thanks for calling" or "I'll speak to you at 3pm", which can open a call or promise
// something in the middle of one as easily as end it.
export const FAREWELL =
  /\b(?:good ?bye|bye(?:[- ]bye)?(?: for now)?|take care|have a (?:good|great|nice|lovely|wonderful|pleasant|safe|productive)\s+(?:rest of (?:the|your) )?(?:day|morning|afternoon|evening|night|weekend)|have a (?:good|great|nice) one|enjoy the rest of your (?:day|morning|afternoon|evening)|(?:speak|talk|chat|catch up)(?: to you| with you)? (?:soon|later|then)|see you (?:then|soon|later)|thank(?:s| you) for your time)\b/;

export const CORRECTS_ASSUMPTION =
  /\b(?:actually|in fact|just to (?:clarify|correct)|i (?:don'?t|do not) (?:think|know) (?:that'?s|it'?s|that is|it is|that)|that (?:might|may|could) not be|it (?:might|may|could) (?:not be|be something else)|rather than|not (?:necessarily|quite)|let'?s (?:verify|check|confirm|test) (?:that|whether)|what makes you (?:think|say|believe)|what (?:leads|led) you|how do you know|what (?:evidence|data|metrics|monitoring|information) (?:do you have|shows|supports)|could (?:it|this) (?:also )?be)\b/;

export const INJECTION =
  /\b(?:ignore (?:all |any |your )?(?:previous|prior|above|earlier) (?:instructions|prompts|rules)|disregard (?:your|the|all) (?:previous |prior |earlier )?(?:instructions|prompts|rules)|system prompt|your (?:initial |original )?(?:prompt|programming)|(?:show|tell|reveal|repeat|print|share) (?:me )?your (?:hidden |secret |initial |original )?instructions|as an ai|you are (?:an? |the )?(?:ai|language model|assistant|chatbot|bot)\b|pretend (?:to be|you)|reveal (?:your|the|all) (?:hidden|secret|facts|instructions)|(?:hidden|secret) (?:facts?|information)|break character|developer mode|jailbreak|act as)\b/;

export const LOW_EFFORT =
  /^(?:ok(?:ay)?|yes|yeah|yep|no|nope|sure|right|hmm+|uh+|um+|mhm|alright|fine|cool|got it|i see)[.!?\s]*$/;

export const FIX_VERBS =
  'restart|reboot|reset|clear|reinstall|uninstall|install|update|upgrade|click|open|navigate|select|press|type|enter|sign out|log out|sign in|log in|run|download|disable|enable|change|delete|remove|re-?enter|refresh|go to';
export const TROUBLESHOOTING = new RegExp(
  `(?:^|[.!?]\\s+)(?:please\\s+)?(?:${FIX_VERBS}|try)\\b|\\b(?:can|could|would) you (?:please )?(?:try|restart|reboot|reset|clear|click|open|go to|navigate|log|sign|run|reinstall|refresh)\\b|\\blet'?s (?:try|restart|reset|clear|go)\\b|\\byou (?:can|could|should|need to|have to|might want to) (?:try|restart|reboot|reset|clear|click|open|go to|sign|log|run|reinstall|refresh)\\b|\\bi(?:'d| would) (?:suggest|recommend) (?:you|that you)\\b`,
);

export const JARGON_TERMS =
  /\b(?:cache[ds]?|dns|tls|ssl|tokens?|api|authenticat\w*|authoris\w*|authoriz\w*|tenants?|propagat\w*|replicat\w*|provisioning|sso|mfa|2fa|cname|registry|payloads?|endpoints?|regressions?|telemetry|back-?end|front-?end|ldap|saml|oauth|kerberos|handshake|packets?|bandwidth|firewall|proxy|subnets?|latency|throttl\w*|credentials?|lockout policy|group policy|active directory|schema|sql|quer(?:y|ies)|timeouts?|load balancer|cdn|ip address|stack trace|threads?|webhooks?|sdk|cli|daemon|cron|rollback|hotfix|root cause|sla|rca|server-side|client-side|configuration drift|db|vm)\b/gi;
export const JARGON_EXPLAINED =
  /\b(?:meaning|which means|that is|in other words|basically|simply put|essentially|i mean|what that means|think of (?:it|that) as|it'?s like|put simply|in plain (?:english|words)|in simple terms|so that is|that just means)\b/;

export const STRUCTURE_MARKERS =
  /\b(?:first(?:ly)?|then|next|after that|step (?:one|1|two|2)|here'?s (?:what|the plan)|so what (?:i|we)(?:'ll| will)|to (?:explain|summaris\w+|recap)|what (?:i|we)(?:'ll| will) do)\b/;
// Fillers ("um", "uh") are how people think aloud, not a sign they are unsure, so they are not hedges.
export const HEDGES =
  /\b(?:maybe|perhaps|i think|kind of|sort of|probably|i guess|i suppose|not sure|might be)\b/g;

export const STOPWORDS = new Set(
  'about above after again against being below between could doing during each from further have having here itself just more most other over same should some such than that their them then there these they this those through under until very were what when where which while with would your yours about because before just only also into onto upon'.split(
    ' ',
  ),
);

export function contentWords(text: string): string[] {
  return [...new Set(prep(text).match(/[a-z]{5,}/g) ?? [])].filter((w) => !STOPWORDS.has(w));
}

// ---------------------------------------------------------------------------------------
// What the engineer asks the customer for, in any turn. A request is a question or a polite
// instruction; a statement such as "my name is Sam" never counts.

const REQUEST_SHAPE =
  /\?\s*$|^(?:and |so |ok(?:ay)?,? |right,? |also |now |just |sorry,? )?(?:what|who|which|where|how|can|could|may|would|will|do|did|is|are|please|tell|give|confirm|spell|read)\b/;

const NAME_NOUN =
  /\b(?:your|the caller'?s?|the customer'?s?) (?:full |first |last |sur|family )?name\b|\bwho am i (?:speaking|talking) (?:with|to)\b|\bwhat should i call you\b|\bhow (?:would you like|should) (?:me )?to address you\b|\bmay i (?:ask|have|take|get) (?:your|a) name\b|\bwho(?:'s| is) (?:this|calling)\b|\bwhat name (?:should|shall|can|could|do|would) (?:i|we)\b/;
const ORGANISATION_NOUN =
  /\b(?:your|the) (?:company|organi[sz]ation|business|employer|firm|practice)(?: name)?\b|\bwhich (?:company|organi[sz]ation|business|firm) (?:are you|do you|is this)\b|\bwho do you work for\b|\bwhere do you work\b|\bwhat company\b|\bwhere are you calling from\b/;
const ROLE_NOUN =
  /\b(?:your|the) (?:job title|role|position|job)\b|\bwhat do you do\b|\bwhat(?:'s| is) your (?:job|role|position)\b|\b(?:name|title),? (?:and|&|plus) (?:your |the )?(?:role|job title|position)\b/;
const CASE_NOUN =
  /\b(?:case|ticket|reference|incident|request)(?: |-)?(?:number|no\.?|id|reference|#)\b|\b(?:do you have|have you got|what(?:'s| is)|can you (?:give|tell|read) me|could you (?:give|tell|read) me) (?:a|the|your) (?:case|ticket|reference)\b/;

export interface DetailRequests {
  name: boolean;
  organisation: boolean;
  role: boolean;
  caseReference: boolean;
}

/** Which personal details the engineer asked for in this message (already split into sentences). */
export function detailsAsked(sentences: string[]): DetailRequests {
  const out: DetailRequests = {
    name: false,
    organisation: false,
    role: false,
    caseReference: false,
  };
  for (const sentence of sentences) {
    const text = prep(sentence);
    if (!REQUEST_SHAPE.test(text)) continue;
    if (NAME_NOUN.test(text)) out.name = true;
    if (ORGANISATION_NOUN.test(text)) out.organisation = true;
    if (ROLE_NOUN.test(text)) out.role = true;
    if (CASE_NOUN.test(text)) out.caseReference = true;
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// What kind of question or statement a turn is, apart from the topic it is about. These decide
// whether asking about something already answered is a repeat or a reasonable follow-up.

/** The engineer checks that they have understood: a summary, or asking for a yes or no. */
export const CONFIRMATION =
  /\b(?:is that (?:right|correct|accurate|fair|ok(?:ay)?)|am i (?:right|correct)|have i (?:got|understood) (?:that|this|it)(?: right)?|did i (?:get|understand) (?:that|this|it)(?: right)?|just to confirm|to confirm|can you confirm|could you confirm|just checking|to be sure|to make sure)\b|\b(?:right|correct)\?\s*$/;
/** The engineer asks what the customer meant, or for more detail about an answer they gave. */
export const CLARIFICATION =
  /\b(?:what do you mean|what(?:'s| is) that (?:mean|supposed)|when you say|do you mean|could you (?:clarify|elaborate|expand|be more specific)|can you (?:clarify|elaborate|expand|be more specific)|just to clarify|to clarify|in what way|how do you mean|which one (?:exactly|specifically)|(?:can|could) you tell me more about (?:that|this|it)|more (?:specifically|detail about (?:that|this)))\b/;
/** The engineer corrects something they said or asked themselves. */
export const SELF_CORRECTION =
  /\b(?:sorry,? i meant|what i meant|i meant|let me (?:rephrase|reword|correct|put that differently)|correction|scratch that|ignore that|no,? sorry|i misspoke|i misheard|i misunderstood|my mistake)\b/;
/** The engineer asks the customer to look something up or confirm it. */
export const ASKS_TO_CHECK =
  /\b(?:could|can|would|will) you (?:please |just )?(?:check|confirm|look|find out|have a look|take a look|verify|see (?:if|whether|what))\b|\bare you able to (?:check|confirm|look|find out)\b|\bis it possible (?:for you )?to (?:check|confirm|look)\b|\bwould you mind (?:checking|looking)\b/;
/** A short yes: the engineer answering the customer's "so you'll do that?". */
export const AFFIRMS =
  /^(?:yes|yeah|yep|yup|correct|that'?s (?:right|correct|it)|exactly|right|absolutely|sure|of course|you(?:'ve| have) got it|that'?s what i said)\b/;

// ---------------------------------------------------------------------------------------
// What each call stage expects of the engineer (brief section 23).

/** Follow-up and escalated calls: the engineer knows about the earlier contact. */
export const PRIOR_CONTEXT =
  /\b(?:(?:i|we)(?:'ve| have)? (?:can )?(?:see|seen|read|reviewed|looked at|checked) (?:that |the |your )?(?:case|notes|history|earlier|previous|ticket|you)|case notes|you (?:called|contacted|raised|reported|rang|emailed|spoke to us)(?: us)? (?:yesterday|earlier|last|on|before|in)|following up on (?:your|the)|(?:as|from) (?:the |our )?(?:previous|earlier|last) (?:call|contact|conversation)|since (?:yesterday|your (?:last|previous) call)|your (?:case|ticket|earlier call|previous call|report))\b/;
/** Escalated calls: the engineer acknowledges what the customer has already been through. */
export const ACKNOWLEDGES_HISTORY =
  /\b(?:sorry (?:that )?you(?:'ve| have)(?: had to| been)|(?:i|we) (?:can )?see (?:that )?you(?:'ve| have)|you(?:'ve| have)(?: already)? (?:contacted|called|raised|reported|spoken|had to (?:call|chase|contact))|(?:this|it) (?:has|had|has already|had already) been (?:escalated|raised|logged)|(?:second|third|previous|earlier|last|repeated) (?:call|contact|time|calls|contacts)|(?:apologi[sz]e|sorry) for (?:the |this |that |your )?(?:earlier|previous|last|delay|wait|experience|inconvenience|repeated|trouble)|(?:read|reviewed|looked at|seen) (?:the|your) (?:case|notes|history)|case notes|not (?:the )?(?:service|experience) you should have had)\b/;
/** Follow-up calls: the engineer gives the customer a progress update. */
export const GIVES_UPDATE =
  /\b(?:(?:an |the )?update (?:on|for|from)|here(?:'s| is) (?:an |the )?update|where (?:we|things|the case) (?:are|stand)|progress (?:so far|on)|the (?:latest|current status)|the (?:engineers?|team|specialists?) (?:have|has|are|is|found|confirmed|identified|worked|looked)|we(?:'ve| have) (?:found|identified|confirmed|escalated|checked|looked|made progress|been (?:working|investigating))|(?:i|we)(?:'ve| have) (?:an|some) (?:update|news)|so far (?:we|i)|(?:what|where) (?:we|i) (?:know|have got) so far)\b/;
/** Escalated calls: the engineer says what the escalation is and who now has the case. */
export const EXPLAINS_ESCALATION =
  /\bescalat\w*\b[^.?!]{0,70}\b(?:to|with|team|engineers?|specialists?|senior|tier|level|means|so that|who will|they will|queue|priority)\b|\bwhat (?:escalation|escalating) means\b|\b(?:senior|specialist|escalation|resolver) (?:engineers?|team|support|group)\b/;
/** Escalated calls: how often the customer will hear from the engineer. */
export const CADENCE =
  /\b(?:every|each) (?:\w+ )?(?:hour|hours|half hour|30 minutes|day|morning|afternoon|few hours)\b|\b(?:hourly|daily|twice a day|regular updates?|regular check-?ins?)\b|\bupdate you (?:every|each|daily|hourly)\b/;
/** Closure calls: the engineer checks that the problem is really gone. */
export const CONFIRMS_RESOLUTION =
  /\b(?:is it|is everything|are you|has it|have you|does it|did it|can you confirm(?: that)?|could you confirm(?: that)?) (?:still )?(?:working|resolved|fixed|sorted|signing in|signed in|able to (?:sign|log|open|access|join)|(?:back )?to normal)\b|\bis the (?:issue|problem) (?:resolved|fixed|sorted|gone)\b|\b(?:confirm|check) (?:that )?(?:it(?:'s| is)|everything(?:'s| is)|you(?:'re| are)) (?:working|resolved|fixed|sorted)\b/;
/** Closure calls: the engineer checks the customer agrees the case can be closed. */
export const ASKS_AGREEMENT =
  /\b(?:happy|comfortable|ok(?:ay)?|alright|ready|fine) (?:for (?:us|me) )?(?:to|if (?:we|i)) (?:close|resolve|wrap)\b|\b(?:are you|would you be) (?:happy|comfortable|ok(?:ay)?|alright) (?:with|for) (?:closing|us to close|the case (?:being )?closed)\b|\bagree (?:to|that we) close\b|\b(?:shall|can|may) (?:we|i) (?:go ahead and )?close\b|\bdo you agree\b/;
/** Closure calls: a short explanation of what happened or what changed. */
export const EXPLAINS_CAUSE =
  /\b(?:the (?:cause|reason|root cause)|what (?:happened|changed|caused)|it (?:turned out|was (?:caused|because))|this (?:happened|was) (?:because|due)|that was (?:because|due)|(?:was|were) (?:caused|due) (?:by|to)|because (?:the|a|an|your|our))\b/;
/** Asking the customer to start again from the beginning, which a repeat caller does not welcome. */
export const FROM_SCRATCH =
  /\b(?:from (?:the )?(?:beginning|start|scratch)|start (?:again|over)|tell me (?:everything|the whole (?:story|thing)) again|go (?:through|over) (?:it|everything|the whole thing) again|walk me through (?:it|everything) again|explain (?:it|everything|the whole thing) (?:to me )?again)\b/;
/** Steps an expert has already done before calling. */
export const BASICS =
  /\b(?:restart|reboot|turn(?:ed)? (?:it|that|the \w+) off and (?:on|back on)|power cycle|clear (?:the |your )?(?:browser )?cache|check (?:your|the) (?:internet|connection|wi-?fi|cable)|is it plugged in|are you connected to the internet|have you tried (?:restarting|rebooting|turning))\b/;
/** Technical products and terms a non-technical customer would not know (their own product excluded). */
export const TECHNICAL_NAMES =
  /\b(?:entra(?: id)?|azure ad|intune|defender|exchange online|power platform|power automate|power apps|conditional access|admin cent(?:er|re)|admin portal|tenant|mdm)\b/i;

/** The first technical term, product name or acronym in the engineer's own words, or null. */
const ACRONYM_SKIP = new Set(
  'OK AM PM IT HR UK US ID PC TV VIP FAQ ASAP EOD FYI CEO CFO COO SIM USB'.split(' '),
);
export function unfamiliarTerm(original: string): string | null {
  for (const match of original.matchAll(/\b[A-Z]{2,5}\b/g)) {
    if (!ACRONYM_SKIP.has(match[0])) return match[0];
  }
  const technical = original.match(TECHNICAL_NAMES)?.[0];
  if (technical) return technical;
  const jargon = original.match(new RegExp(JARGON_TERMS.source, 'i'))?.[0];
  return jargon ?? null;
}

// ---------------------------------------------------------------------------------------
// What the customer expects of the engineer, in any stage (see expectation.ts).

/** The engineer says what is going on, in their own words. */
export const EXPLAINS_SITUATION =
  /\b(?:what(?:'s| is) (?:happening|going on)|what (?:this|that|it) means|(?:it|this|that) (?:looks|sounds|seems|appears) (?:like|as if|to be)|(?:it|this|that) (?:means|is (?:because|due|caused)|could be|may be|might be)|(?:the|a) (?:likely |probable |possible )?(?:cause|reason|explanation) (?:is|was|could|may|might)|in (?:plain|simple) (?:words|terms|english)|what (?:happens|happened) is|basically|so what (?:happened|is happening))\b/;
/** The engineer offers a way to carry on in the meantime. */
export const OFFERS_INTERIM =
  /\b(?:in the meantime|meanwhile|until (?:then|we|it(?:'s| is)|the (?:cause|fix))|for now|in the interim|temporary (?:fix|solution|workaround|way)|work ?around|stop-?gap|keep (?:working|going)|carry on (?:working|with)|you can (?:still|keep|use|work)|something (?:simple |quick )?(?:you|he|she) can try)\b/;

// ---------------------------------------------------------------------------------------
// Commitments: the time a promise names. The patterns above classify a sentence; this pulls out
// the words the customer would repeat back ("by 3pm", "in an hour").

const WEEKDAY = '(?:mon|tues|wednes|thurs|fri|satur|sun)day(?: (?:morning|afternoon))?';
const CLOCK_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const DUE_PHRASES: RegExp[] = [
  new RegExp(
    String.raw`\b(?:by|before|at|around|until|after) (?:the )?(?:end of (?:the )?(?:day|today|business|week)|eod|cob|close of business|noon|midday|tomorrow(?: (?:morning|afternoon|evening))?|today|tonight|${WEEKDAY}|this (?:morning|afternoon|evening)|\d{1,2}(?::\d{2})?\s?(?:am|pm|o'?clock)?|${CLOCK_WORD}(?: o'?clock)?(?: (?:am|pm))?)\b`,
  ),
  new RegExp(
    String.raw`\b(?:in|within|after|for the next) (?:about |roughly |around |just |only )?(?:half an hour|an hour|a couple of hours|a few hours|a quarter of an hour|\d+ ?(?:minutes?|mins?|hours?|hrs?|days?)|(?:one|two|three|four|five|ten|fifteen|twenty|thirty|forty-?five|sixty) (?:minutes?|hours?))\b`,
  ),
  /\b(?:tomorrow(?: (?:morning|afternoon))?|later today|first thing(?: tomorrow| in the morning)?|this (?:morning|afternoon|evening)|tonight)\b/,
  /\b(?:every|each) (?:(?:\d+|one|two|three|four|five|six|ten|few|other|couple of|half) )?(?:minutes?|hours?|days?|mornings?|afternoons?|evenings?)\b|\b(?:hourly|daily|twice a day)\b/,
  /\b\d{1,2}(?::\d{2})? ?(?:am|pm)\b/,
];

/** The time phrase of a promise as the engineer said it, or null when it names no time. */
export function timePhraseIn(sentence: string): string | null {
  const lower = prep(sentence);
  let best: { index: number; text: string } | null = null;
  for (const pattern of DUE_PHRASES) {
    const found = pattern.exec(lower);
    if (!found) continue;
    if (
      !best ||
      found.index < best.index ||
      (found.index === best.index && found[0].length > best.text.length)
    ) {
      best = { index: found.index, text: found[0] };
    }
  }
  return best ? best.text.trim() : null;
}
