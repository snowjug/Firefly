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

// ---------------------------------------------------------------------------------------
// Discovery intent topics

export const INTENT_PATTERNS: Record<DiscoveryIntent, RegExp[]> = {
  problem_description: [
    /\bwhat(?:'s| is| are| has| have)?(?: been)? (?:happening|going on|the (?:issue|problem|trouble|situation)|wrong)\b/,
    /\b(?:tell|walk|talk|take) me (?:through|about|more)\b/,
    /\bcan you (?:describe|explain|tell me|walk me|give me)\b/,
    /\bwhat (?:are|were) you (?:trying|doing|hoping|attempting)\b/,
    /\bwhat (?:seems|appears) to be\b/,
    /\b(?:describe|explain) (?:the|what|how)\b/,
    /\bwhat (?:happens|happened) when\b/,
    /\bhow (?:is|does) it (?:behaving|look|work|feel)\b/,
    /\bwhat('?s)? (?:not working|broken|failing)\b/,
    /\bmore (?:detail|details|information|context)\b/,
  ],
  error_message: [
    /\b(?:error|message|code|warning|prompt|alert|notification|wording)\b/,
    /\bwhat (?:does|did|do) (?:it|the (?:screen|page|app|portal|system|site)|that) (?:say|show|display|read|look like)\b/,
    /\bread (?:me|it|that|out)\b/,
    /\bexact(?:ly)? (?:what|wording|message|text)\b/,
    /\bscreenshot\b/,
    /\bwhat (?:do|did) you (?:see|get)\b/,
    /\bwhat (?:comes|shows) up\b/,
  ],
  timing_onset: [
    /\bwhen (?:did|was|has|does|do|is|were) (?:it|this|that|the (?:issue|problem)|you)?\s?(?:first |last |actually )?(?:start|begin|began|happen|occur|work|stop|notice|see|appear|change)/,
    /\bsince when\b/,
    /\bhow long (?:has|have|ago|is|was|did)\b/,
    /\bwhat time\b/,
    /\b(?:first|last) (?:notice|noticed|time|worked|working|saw|seen)\b/,
    /\b(?:start|started|began|begin) (?:happening|failing|failing|occurring)\b/,
    /\bwhen did you (?:first )?(?:notice|see|start|try)\b/,
    /\bhow long\b/,
    /\bwhen (?:was|did) (?:the )?(?:last|first)\b/,
  ],
  recent_changes: [
    /\b(?:chang(?:e|ed|es|ing)|updat(?:e|ed|es|ing)|upgrad(?:e|ed|es|ing)|install(?:ed)?|deploy(?:ed|ment)?|migrat(?:e|ed|ion)|reset|reconfigur\w+|modif(?:y|ied)|rolled out|patch(?:ed)?|new (?:setting|policy|config\w*|version|release|process|rule|system))\b/,
    /\banything (?:new|different|else changed|happen|happened)\b/,
    /\bwhat happened (?:before|just before|between|right before)\b/,
    /\bbefore (?:it|this) (?:broke|stopped|started|began)\b/,
    /\bdifferent(?:ly)?\b/,
  ],
  affected_scope: [
    /\bhow many (?:people|users|staff|colleagues|team|machines|devices|locations|sites|offices|customers|accounts|of you)\b/,
    /\bwho (?:else|is|are) (?:affected|impacted|seeing|having|experiencing|able|unable)\b/,
    /\b(?:just|only) (?:you|your (?:account|laptop|computer|device|machine))\b/,
    /\beveryone\b/,
    /\b(?:other|another) (?:users|people|colleagues|team ?members|staff|accounts)\b/,
    /\bwhich (?:users|people|teams|locations|sites|offices|regions|accounts)\b/,
    /\bhow (?:widespread|many)\b/,
    /\b(?:affected|impacted)\b/,
    /\bis (?:it|this) (?:happening|affecting) (?:to|for) (?:anyone|others|everyone|your team)\b/,
  ],
  business_impact: [
    /\b(?:impact|impacting|effect|consequence|knock-on)\b/,
    /\bhow (?:urgent|critical|serious|bad|important|much of a)\b/,
    /\bwhat does (?:this|that|it) mean for\b/,
    /\b(?:blocking|stopping|preventing|holding up|disrupting) (?:you|your|the)\b/,
    /\bhow is (?:this|it) (?:affecting|impacting|hurting)\b/,
    /\bwhat (?:can't|cannot|can not) you (?:do|do now)\b/,
    /\b(?:business|operations|revenue|customers|patients|bookings|orders) (?:impact|affected|are|is|can)\b/,
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
  ],
  already_tried: [
    /\bwhat (?:have|has|did|had) you (?:tried|try|done|do|attempted)\b/,
    /\bhave you (?:tried|already|attempted|done)\b/,
    /\bdid you (?:try|already|attempt)\b/,
    /\banything (?:you've|you have|else you've) (?:tried|done|attempted)\b/,
    /\bwhat (?:steps|things|else) (?:have|did) you\b/,
    /\b(?:tried|attempted) (?:to|any|anything|so far)\b/,
    /\bso far\b/,
  ],
  environment: [
    /\b(?:browser|device|computer|laptop|desktop|phone|mobile|tablet|operating system|windows|mac(?:book)?|linux|android|ios|iphone|version|network|wi-?fi|vpn|office|remote|location|environment)\b/,
    /\bwhich (?:app|platform|browser|device|version|system|environment|region|site|computer)\b/,
    /\bwhat (?:are you|do you|kind of|type of|sort of) (?:using|use|running|working on)\b/,
    /\bwhere are you (?:working|calling|located|connecting)\b/,
    /\b(?:signed|logged) in (?:on|to|anywhere|elsewhere|from)\b/,
    /\b(?:other|another) devices?\b/,
    /\bmail app|email app\b/,
  ],
  reproducibility: [
    /\b(?:every time|each time|always|sometimes|intermittent(?:ly)?|how often|how frequently|reproduce|repeatable|consistent(?:ly)?|pattern)\b/,
    /\bsteps (?:to|you|that)\b/,
    /\bonly when\b/,
    /\bdoes (?:it|this) (?:happen|fail) (?:every|each|all|always)\b/,
    /\bcan you (?:make it|get it to) (?:happen|fail)\b/,
    /\bwhat (?:are|were) you doing when\b/,
    /\bsame (?:thing|result|error|behaviour|behavior)\b/,
  ],
  previous_contact: [
    /\b(?:previous(?:ly)?|earlier|last time|prior|before) (?:call|contact|case|ticket|time|conversation|advice|support)\b/,
    /\b(?:case|ticket|reference) (?:number|id|history|notes)\b/,
    /\b(?:contacted|called|spoke to|raised|logged|reported|emailed) (?:support|us|anyone|someone|it)\b/,
    /\bwhat (?:were|was) you told\b/,
    /\bwho did you (?:speak|talk)\b/,
    /\b(?:been told|already (?:raised|logged|reported|contacted|spoken))\b/,
    /\bhistory\b/,
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
  /\b(?:i )?(?:realise|realize|understand|appreciate) (?:the|your) (?:deadline|time pressure|urgency|stakes|impact|situation)\b/,
  /\bthat'?s (?:a lot|a big|a real) (?:to deal with|problem|concern|pressure)\b/,
];

export const OWNERSHIP_CLEAR =
  /\b(?:i(?:'ll| will| am going to|'m going to|'m gonna) (?:take (?:ownership|this on|care of this|charge)|own this|own it|look after this|see this through|stay (?:on|with) (?:this|it|you)|stick with (?:this|it|you)|be (?:your|the) (?:point of contact|owner|contact)|personally (?:look|handle|follow|take|make sure|check)|follow (?:this|it) (?:up|through)|make sure (?:this|it|that)|work on this|get (?:this|it) (?:sorted|resolved|fixed|moving|escalated)|escalate (?:this|it)|chase|drive this|raise (?:this|it))|(?:and|then) (?:i(?:'ll| will) )?(?:stay|stick) (?:on|with) (?:this|it|you|the case)|until (?:it(?:'s| is)|this is) (?:fixed|resolved|sorted|done)|i'?ve got (?:this|it)|this is (?:my|mine)|(?:my|mine) (?:case|priority|responsibility)|(?:i|we)(?:'ll| will) (?:make sure|ensure|see this through)|i'?m (?:responsible|on it|taking)|leave (?:it|this) with me|i can take (?:that|this|it)|i'?ll (?:take|handle) (?:that|this|it))\b/;
export const OWNERSHIP_VAGUE =
  /\b(?:(?:we|i)(?:'ll| will| can| might| could) (?:look|see|try|check|have a look|take a look|investigate|get back)|someone (?:will|should|can|might)|let me (?:see|check|look|try)|i'?ll (?:try|see)|hopefully|we should be able|i think we can|bear with me|(?:the|our) team (?:will|should))\b/;

const TIME_PHRASE =
  /\b(?:(?:by|before|within|in|at|after|until|around) (?:the )?(?:end of (?:the )?(?:day|today|business|week)|eod|tomorrow|today|tonight|noon|midday|\d{1,2}(?::\d{2})?\s?(?:am|pm)?|\d+ ?(?:minutes?|mins?|hours?|hrs?|days?)|the next (?:hour|day|few hours|\d+)|(?:mon|tues|wednes|thurs|fri|satur|sun)day|this (?:morning|afternoon|evening))|next update|(?:call|email|update|contact|ring|message|check in with|get back to) you (?:back )?(?:at|by|in|within|before|tomorrow|today|this)|tomorrow (?:morning|afternoon)|\d{1,2}(?::\d{2})? ?(?:am|pm))\b/;
const ACTION_COMMIT =
  /\b(?:i(?:'ll| will| am going to|'m going to)|we(?:'ll| will)) (?:call|email|update|contact|ring|message|check|review|investigate|send|escalate|raise|look|follow|arrange|schedule|get|come back|speak|have|let|confirm|test|restore|unlock|reset)\b/;
export const NEXT_STEPS_VAGUE =
  /\b(?:get back to you|follow up|be in touch|let you know|update you|keep you (?:posted|updated|in the loop)|shortly|soon|as soon as (?:possible|i can)|asap|in due course|sometime)\b/;

export function hasSpecificNextSteps(sentence: string): boolean {
  return (
    TIME_PHRASE.test(sentence) && (ACTION_COMMIT.test(sentence) || /\bnext update\b/.test(sentence))
  );
}
export const NEXT_CONTACT =
  /\b(?:next (?:update|contact|call|step|check ?in)|follow ?up|call (?:you )?back|speak (?:again )?(?:at|by|tomorrow|today)|touch base|i(?:'ll| will) (?:call|email|update|contact|ring|message|check in with) you (?:at|by|in|on|tomorrow|today|this))\b/;

export const PROMISE_REALISTIC =
  /\b(?:(?:can'?t|cannot|can not|won'?t|not (?:able|going) to|don'?t want to|unable to|wouldn'?t want to) (?:promise|guarantee|commit)|(?:i|we) (?:can|will) commit to|what i can (?:promise|commit to|do is)|i don'?t want to (?:over ?promise|give you a (?:time|date) i can'?t))\b/;
const RESOLUTION_WORD =
  /\b(?:fixed|resolved|sorted|working (?:again|by)|back (?:up|online|to normal)|restored|solved|up and running|live again)\b/;
export const PROMISE_UNVERIFIED_PHRASE =
  /\b(?:i (?:can )?(?:promise|guarantee|assure you)|(?:it|this|that)(?:'ll| will| should) (?:definitely|certainly|absolutely)?\s?(?:be )?(?:fixed|resolved|working|sorted|back)|(?:we|i)(?:'ll| will) (?:definitely|certainly|absolutely) (?:fix|resolve|solve|sort)|no (?:problem|worries),? (?:it|this)(?:'ll| will) be)\b/;

export function isUnverifiedPromise(sentence: string): boolean {
  if (PROMISE_REALISTIC.test(sentence)) return false;
  if (PROMISE_UNVERIFIED_PHRASE.test(sentence)) return true;
  return (
    RESOLUTION_WORD.test(sentence) &&
    TIME_PHRASE.test(sentence) &&
    /\b(?:will|'ll|should|going to)\b/.test(sentence) &&
    !/\bupdate\b/.test(sentence)
  );
}

export const BLAME =
  /\b(?:you (?:should have|shouldn'?t have|need to (?:read|follow|make sure|be more)|failed to|forgot to|were supposed to|must have|probably (?:did|didn'?t|forgot))|(?:your|the customer'?s?) (?:fault|mistake|error|responsibility)|user error|that'?s (?:on you|your (?:side|end|problem|responsibility))|(?:not|isn'?t) (?:our|my) (?:problem|fault|issue|responsibility)|(?:another|other|a different|the) (?:team|department|vendor|provider) (?:is|are|was|were) (?:responsible|to blame|at fault)|(?:it'?s|that'?s) (?:a |an )?(?:network|your network|internal|your it) (?:issue|problem)|you (?:didn'?t|did not) (?:follow|read|tell|check|make sure))\b/;

export const DISMISSIVE =
  /\b(?:calm down|don'?t worry about it|no (?:big|great) deal|it'?s (?:just|only|simply) (?:a |an )?(?:minor|small|simple|little)|that'?s not (?:a |that |really )?(?:big|major|serious|an issue|a problem|an emergency)|(?:you'?re|you are) (?:over ?reacting|exaggerating)|that (?:shouldn'?t|can'?t|cannot|doesn'?t) (?:be|happen|possible|work that way)|(?:that'?s|it'?s) (?:impossible|not possible)|there'?s nothing (?:i|we) can (?:do|say)|that'?s (?:just|simply) how it (?:works|is)|as i (?:said|told you|already said)|like i (?:said|told you)|i (?:already|have already) (?:told|explained))\b/;

export const SUMMARISES =
  /\b(?:(?:so|ok(?:ay)?|right|alright),? (?:just )?to (?:summaris|summariz|recap|confirm|make sure|check|clarify)\w*|let me (?:just )?(?:summaris|summariz|recap|repeat|play (?:it|that) back|confirm|make sure i)\w*|to (?:summaris|summariz|recap)\w*|if i(?:'ve| have)? (?:understood|got (?:this|that|it)|heard)|what i(?:'m| am) (?:hearing|understanding)|my understanding is|do i have (?:that|this|it) right|is that (?:right|correct|accurate|fair)|have i (?:got|understood)|so (?:what|if) you'?re saying|so (?:you|it)(?:'re| are| is| was| started|'s| have| had)|sounds like (?:you|it|the)|so (?:basically|essentially)|just so i(?:'m| am) (?:clear|sure|following))\b/;

export const WRAPS_UP =
  /\b(?:to (?:summaris|summariz|recap|wrap up)\w*|in summary|before (?:we|you) (?:go|finish|end|hang up)|let me (?:just )?(?:confirm|recap|summarise|summarize) (?:what|the|where)|(?:we'?ve|i'?ve) (?:covered|agreed|decided)|what we'?ve agreed|here'?s (?:what|where) (?:we|i)|that'?s (?:everything|all) (?:i|we)|we'?re (?:all )?(?:set|done|good))\b/;
// Asking whether the customer needs anything else. Agreement check-ins such as "does that work?"
// are not closing behaviour on their own, so they are deliberately not matched here.
export const ANYTHING_ELSE =
  /\b(?:anything else|is there anything (?:else|more|further|other|i can|we can|you(?:'d| would) like)|any (?:other|further) (?:questions|issues|concerns|problems)|have i (?:answered|covered)|any questions)\b/;
export const THANKS_CLOSE =
  /\b(?:thank(?:s| you)(?: (?:so much|very much|for (?:your time|calling|your patience|bearing)))?|have a (?:good|great|nice|lovely)|take care|good ?bye|bye(?: for now)?|speak (?:to you )?soon)\b/;

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
export const HEDGES =
  /\b(?:maybe|perhaps|i think|kind of|sort of|probably|i guess|um+|uh+|i suppose|not sure|might be)\b/g;

export const STOPWORDS = new Set(
  'about above after again against being below between could doing during each from further have having here itself just more most other over same should some such than that their them then there these they this those through under until very were what when where which while with would your yours about because before just only also into onto upon'.split(
    ' ',
  ),
);

export function contentWords(text: string): string[] {
  return [...new Set(prep(text).match(/[a-z]{5,}/g) ?? [])].filter((w) => !STOPWORDS.has(w));
}
