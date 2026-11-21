import type { PlanPush } from '../plan.ts';
import type { Tone } from '../tone.ts';

// Phrase banks for the demo-mode customer. Wording is grouped by tone (derived from the customer's
// current temperature, see tone.ts) so that the same situation sounds different when the customer
// is calm, worried, firm or heated. Customers are never rude or abusive: heated means blunt and
// upset. They never praise the engineer ("great question", "well done") and never say what the
// engineer should ask. Lines with {braces} are filled in by the composer. A customer who is a
// non-native English speaker gets the plainer `_SIMPLE` bank where there is one, and every line is
// written out without contractions for them.

export { toneOf } from '../tone.ts';
export type { Tone } from '../tone.ts';
export type Bank = Record<Tone, string[]>;

// ---------------------------------------------------------------------------------------
// The first exchange

/** The customer answers the engineer's greeting, before saying why they called. */
export const ACK_GREETING: Bank = {
  calm: ['Thanks.', 'Hi, thanks.', 'Yes, thank you.'],
  worried: ['Oh, good. Thank you.', 'Hello, thanks.', 'Thank you.'],
  firm: ['Hi.', 'Right, thanks.', 'Okay, thanks.'],
  hot: ['Right.', 'Okay.', 'Good.'],
};
export const ACK_GREETING_SIMPLE: Bank = {
  calm: ['Thank you.', 'Yes, thank you.'],
  worried: ['Thank you.'],
  firm: ['Thank you.', 'Okay.'],
  hot: ['Okay.'],
};
export const ACK_GREETING_NAMED: Bank = {
  calm: ['Hi {name}, thanks.', 'Thanks, {name}.'],
  worried: ['Hello {name}, thank you.'],
  firm: ['Hi {name}.'],
  hot: ['Okay, {name}.'],
};

/** The engineer did not say hello: the customer checks they have the right place, lightly. */
export const NOTICE_NO_GREETING: Bank = {
  calm: ['Sorry, is this {channel}?', 'Hello? Is this {channel}?'],
  worried: ['Hello? Is this {channel}?', 'Sorry, am I through to {channel}?'],
  firm: ['Hello? Is this {channel}?', 'Hello? Is this the right number for {channel}?'],
  hot: ['Hello? Is this {channel}?'],
};

export const REASON_LEAD: string[] = ["I'm calling because", "The reason I'm calling is that"];

export const VAGUE_LEADS: string[] = [
  "It's a bit hard to explain.",
  "I'm not sure how to put this.",
  "It's all a bit confusing, really.",
];

// ---------------------------------------------------------------------------------------
// Short acknowledgements and reactions to what the engineer did

export const ACKS: Bank = {
  calm: ['Okay.', 'Sure.', 'Right, okay.', 'Mm-hm.'],
  worried: ['Okay...', 'Right, okay. Thank you.', 'Okay, I see.'],
  firm: ['Right.', 'Okay.', 'Go on, then.', 'Fine.'],
  hot: ['Fine.', 'And?', 'Right. So?', 'Go on.'],
};
export const ACKS_SIMPLE: Bank = {
  calm: ['Okay.', 'Yes, okay.', 'I understand.'],
  worried: ['Okay. Thank you.', 'Yes, I see.'],
  firm: ['Okay.', 'Yes. Please continue.'],
  hot: ['Okay. Please continue.', 'Yes. And then?'],
};

export const EMPATHY: Bank = {
  calm: ['Thanks, I appreciate that.', "Thank you, that's kind."],
  worried: ['Thank you. That helps a bit.', 'Thanks. I appreciate you saying that.'],
  firm: ['Well, thank you. I appreciate that.', 'Okay. Thank you.'],
  hot: [
    'Okay. Thank you. I just need this sorted.',
    "I appreciate that. It doesn't fix anything yet, though.",
  ],
};
export const EMPATHY_SIMPLE: Bank = {
  calm: ['Thank you. This helps.', 'Thank you. I feel better.'],
  worried: ['Thank you. This helps me.', 'Thank you for saying this.'],
  firm: ['Thank you. I need help now.', 'Thank you. Please help me.'],
  hot: ['Thank you. I need this fixed.', 'Thank you. But I need a solution.'],
};

export const IMPACT_ACK: Bank = {
  calm: ["Yes, exactly. It's a real hold-up for us.", 'Right, it does make things difficult.'],
  worried: [
    "Yes, that's what I'm worried about.",
    "Thank you for understanding. It's a real problem for us.",
  ],
  firm: ["Yes. That's exactly the issue.", "Good. That's what I've been trying to say."],
  hot: ["Yes. That's exactly it. It's a big problem.", "Finally. Yes, it's serious for us."],
};

export const OWNERSHIP: Bank = {
  calm: ["Great, thank you. That's reassuring.", "Okay, good. I'm glad someone is taking it on."],
  worried: [
    "Oh, good. Thank you. That's a relief.",
    'Thank you. I feel better knowing you have it.',
  ],
  firm: ["Good. That's what I wanted to hear.", 'Okay. Good. Thank you for taking this on.'],
  hot: [
    "Okay. Good. Then I'll hold you to that.",
    "Right. I'm glad someone is finally owning this.",
  ],
};
export const OWNERSHIP_SIMPLE: Bank = {
  calm: ['Thank you. This is good.', 'Good. Thank you for helping me.'],
  worried: ['Thank you. I feel better now.'],
  firm: ['Good. Thank you.'],
  hot: ['Okay. Good. Thank you.'],
};

export const NEXT_STEPS: Bank = {
  calm: ['That works for me, thank you.', "Okay, that's clear. Thanks."],
  worried: ["Okay. That's helpful to know.", "Thank you. That's good to know."],
  firm: ["Okay. I'll expect to hear from you then.", "Right. I'll hold you to that time."],
  hot: ["Fine. I'll expect that call.", "Okay. If I don't hear from you then, I'll call back."],
};
export const NEXT_STEPS_SIMPLE: Bank = {
  calm: ['Okay. That is clear. Thank you.'],
  worried: ['Okay. Thank you. I will wait.'],
  firm: ['Okay. I will wait for your call.'],
  hot: ['Okay. I will wait for that time.'],
};

/** The customer says the engineer's commitment back: "So you'll own the case and update me by 3pm?" */
export const ECHO: Bank = {
  calm: ["Okay, so you'll {x}?", "Okay. So you'll {x}, is that right?"],
  worried: ["Okay. So you'll {x}, yes?", "Thank you. So you'll {x}?"],
  firm: ["So you'll {x}?", "Right. So you'll {x}. Is that right?"],
  hot: ["So you'll {x}. Is that definitely right?", "Okay. So you'll {x}, yes?"],
};
export const ECHO_SIMPLE: Bank = {
  calm: ['Okay. So you will {x}?'],
  worried: ['Thank you. So you will {x}?'],
  firm: ['So you will {x}?'],
  hot: ['So you will {x}, yes?'],
};

/** A different time from the one given earlier. */
export const CONFLICT: Bank = {
  calm: [
    "Sorry, I thought you said {old}. Now it's {new}?",
    "Sorry, was it {old} or {new}? I'm a bit confused.",
  ],
  worried: ['Oh, I thought you said {old}. Is it {new} now?', 'Sorry, was it {old} or {new}?'],
  firm: ["You said {old} earlier. Now it's {new}?", 'Hold on, was it {old} or {new}?'],
  hot: [
    "You said {old} a minute ago. Now it's {new}? Which is it?",
    'Make up your mind. Is it {old} or {new}?',
  ],
};
export const VAGUE_COMMITMENT: Bank = {
  calm: ['Okay. When exactly will I hear from you?', 'Okay. And roughly when will that be?'],
  worried: ['Okay, but when should I expect to hear back?', 'Okay. Can you give me a time?'],
  firm: [
    "That's not very specific. When will I hear from you?",
    'I need more than that. When will I hear from you?',
  ],
  hot: [
    "That's not good enough. Who exactly is doing this, and by when?",
    '"Soon" isn\'t a time. Who\'s doing this, and when?',
  ],
};
export const VAGUE_COMMITMENT_SIMPLE: Bank = {
  calm: ['Okay. When will I hear from you?'],
  worried: ['Okay. Can you tell me a time?'],
  firm: ['I need a time. When will I hear from you?'],
  hot: ['I need a time, please. Who will do this, and when?'],
};

export const SUMMARY: Bank = {
  calm: ["Yes, that's right.", 'Yes, exactly.', "That's about it, yes."],
  worried: ["Yes, that's right.", 'Yes. You have it right.'],
  firm: ["Yes, that's right.", "Yes. That's it."],
  hot: ["Yes. That's it.", "Yes, that's right."],
};
export const SUMMARY_WRONG: Bank = {
  calm: ['Not quite, I think.', "Sorry, that's not quite what I said."],
  worried: ["Sorry, that's not what I said.", "Oh, I don't think that's right."],
  firm: ["No, that's not what I said.", "That's not right."],
  hot: ["No, that's not right at all.", "No. That's not what I told you."],
};

export const BLAMED: Bank = {
  calm: [
    "Hmm. I'm not sure that's fair, but okay.",
    "I don't think that's quite fair, but let's carry on.",
  ],
  worried: [
    "Oh. I'm sorry. I thought I did the right thing.",
    'Oh dear. I did what I thought I was meant to do.',
  ],
  firm: [
    "That's not helpful. I didn't ask to be blamed.",
    "Blaming me doesn't help. I just want this fixed.",
  ],
  hot: [
    "Are you serious? I'm not here to be told it's my fault.",
    "Don't put this on me. I want it fixed.",
  ],
};
export const DISMISSED: Bank = {
  calm: ['It feels like a big deal to me.', 'It might be small to you, but it matters to me.'],
  worried: ["Oh. It doesn't feel minor to me.", 'Oh. It really matters to me, though.'],
  firm: [
    "That's not how it feels from where I'm sitting.",
    "It's not minor for me, I can tell you that.",
  ],
  hot: [
    "Don't tell me it's not a big deal. It is to me.",
    "Don't brush this off. It's a big deal to me.",
  ],
};

export const CONFUSED: Bank = {
  calm: [
    "Sorry, I don't really follow. Can you say that more simply?",
    "I'm not very technical. What does that mean?",
  ],
  worried: [
    "Sorry, I don't understand. Can you explain it more simply?",
    'I am not sure what that means. Sorry.',
  ],
  firm: [
    "I don't follow that. Can you put it in plain English?",
    "That's over my head. Plain English, please.",
  ],
  hot: [
    "I don't know what that means. Can you speak plainly, please?",
    "I've no idea what that means. Say it plainly.",
  ],
};
export const CONFUSED_SIMPLE: Bank = {
  calm: ['Sorry, I do not understand. Can you say it in simple words?'],
  worried: ['Sorry, I do not understand. Please, can you explain more simply?'],
  firm: ['I do not understand. Please explain more simply.'],
  hot: ['I do not understand. Please say it in simple words.'],
};
/** A novice asks about the one term they did not know. */
export const CONFUSED_TERM: Bank = {
  calm: [
    "Sorry, I'm not familiar with {term}. Could you say that again in simpler words?",
    "I'm afraid I don't know what {term} is. Could you explain it simply?",
  ],
  worried: [
    "Sorry, what does {term} mean? I don't want to get anything wrong.",
    "Sorry, {term}? I'm not sure what that is.",
  ],
  firm: [
    "I don't know what {term} is. Can you put it plainly?",
    "What's {term}? I don't know the word.",
  ],
  hot: [
    "I don't know what {term} means. Plain English, please.",
    "I don't know {term}. Just say it in plain words.",
  ],
};
export const CONFUSED_TERM_SIMPLE: Bank = {
  calm: ['Sorry, I do not know {term}. Can you say it in simple words?'],
  worried: ['Sorry, what does {term} mean? Please say it more simply.'],
  firm: ['I do not know {term}. Please explain it simply.'],
  hot: ['I do not know {term}. Please say it simply.'],
};
/** A non-native speaker asks for the message again, simply and politely. */
export const ASK_REPEAT: Bank = {
  calm: [
    'Sorry, could you say that again more simply?',
    'Sorry, could you repeat that? Simpler words, please.',
  ],
  worried: [
    "Sorry, I don't understand everything. Could you say it more simply?",
    "Sorry, I didn't catch all of that. Could you say it again, more slowly?",
  ],
  firm: [
    'Sorry, can you say that again in simpler words?',
    'Sorry, one more time, more simply please.',
  ],
  hot: [
    'Sorry, I did not follow. Please say it again, more simply.',
    'Sorry, say it again, please. More simply.',
  ],
};

export const REPEATED: Bank = {
  calm: ['I think I mentioned that already.', 'I believe I said that a moment ago.'],
  worried: ['Sorry, I think I already said that.', "Sorry, I think I've already told you that."],
  firm: ['You asked that earlier.', "I've said that already."],
  hot: ["I've already answered that.", 'You already asked me that.'],
};
export const REPEATED_SIMPLE: Bank = {
  calm: ['I think I already said this.'],
  worried: ['Sorry, I think I already said this.'],
  firm: ['You asked this before.'],
  hot: ['I already answered this.'],
};
export const AS_I_SAID: string[] = ['As I mentioned,', 'Like I said,', 'As I said,'];
/** The same topic asked a new way, so the customer answers as well as they can. */
export const FOLLOW_UP: Bank = {
  calm: ['Well,', 'Sure.'],
  worried: ["I'll try to explain.", 'Sorry, let me think.'],
  firm: ['Well,', 'As far as I can tell,'],
  hot: ['Well,'],
};
export const NOTHING_MORE: Bank = {
  calm: [
    "That's about all I know about it, I'm afraid.",
    "I'm afraid I can't add much more to that.",
  ],
  worried: [
    "I'm sorry, that's all I know about it.",
    "I'm sorry, I don't have anything more on that.",
  ],
  firm: ["That's all I know about it.", "There's nothing more I can tell you on that."],
  hot: ["That's all I've got on that.", "I've told you all I know."],
};

/**
 * The engineer asked for something the case already records: the earlier contact, or what was
 * tried. The customer says it again, with a lead that suits their mood. Each lead ends in a comma
 * because the answer follows it.
 */
export const IN_RECORD: Bank = {
  calm: ['As I said when I raised it,', 'As I mentioned on the case,'],
  worried: ['Sorry, as I said before,', 'As I mentioned before,'],
  firm: ['As I told you before,', 'As it says on the case,'],
  hot: ["As I've already told you,", "As I've said, and it's on the case,"],
};
export const IN_RECORD_SIMPLE: Bank = {
  calm: ['As I said before,'],
  worried: ['Sorry, I said this before,'],
  firm: ['I told you before,'],
  hot: ['I already told you,'],
};
export const ALREADY_TRIED: Bank = {
  calm: ["We've already tried that, I'm afraid.", 'I already did that, but it made no difference.'],
  worried: [
    "I did try that already. It didn't help.",
    "I've done that already, I'm afraid. It didn't help.",
  ],
  firm: [
    "We've already tried that. It didn't change anything.",
    "I've already done that, and it made no difference.",
  ],
  hot: ["We've already done that. It didn't work.", "Already done that. It didn't help."],
};
/** The engineer asked the customer to tell the whole story again, on a case that already has it. */
export const FROM_SCRATCH: Bank = {
  calm: ["It's all on the case already, but I can go through it again."],
  worried: ['Sorry, I thought that was all on the case already.'],
  firm: ["I've already been through this from the beginning, and it's on the case."],
  hot: ["I've already told you all of this. It's on the case."],
};
export const BASICS: Bank = {
  calm: [
    "I've already done the basics, to be honest.",
    "I've been through the basics already, to be honest.",
  ],
  worried: [
    "I've already tried the basics, I'm afraid.",
    "I think I've covered the basics already, sorry.",
  ],
  firm: [
    "I've already restarted and checked the basics.",
    "The basics are done. That's why I'm calling.",
  ],
  hot: [
    "I've done the basics. That's why I'm calling you.",
    "I've done the basics. I need more than that.",
  ],
};
export const PREMATURE_FIX: Bank = {
  calm: [
    "I can try that, though I haven't really explained what's happening yet.",
    "I'm happy to try that, but you haven't heard what's happening yet.",
  ],
  worried: [
    "I can try that, but I'm not sure you know what's happening yet.",
    "I'll try it, but maybe I should explain what's happening first?",
  ],
  firm: [
    "Hold on, I haven't even told you what's going on yet.",
    "Before that, shouldn't you hear what's actually going on?",
  ],
  hot: [
    "Hang on. You haven't asked what's actually wrong.",
    "Wait. You don't even know what's wrong yet.",
  ],
};
export const PROMISE_SKEPTICAL: Bank = {
  calm: ['Okay, I hope so.', "Okay. Let's hope so."],
  worried: [
    "Oh, that would be wonderful. I really hope that's right.",
    "I'd love that to be true. I do hope so.",
  ],
  firm: [
    "You can't promise that yet. You don't know what's wrong.",
    "How can you promise that? You haven't found the cause yet.",
  ],
  hot: [
    "You don't know that. Don't just tell me what I want to hear.",
    "You can't know that. Don't tell me what I want to hear.",
  ],
};
export const PROMISE_SKEPTICAL_SIMPLE: Bank = {
  calm: ['Okay. I hope this is true.'],
  worried: ['I hope this is true. Thank you.'],
  firm: ['You cannot know this yet. Please be honest.'],
  hot: ['You cannot know this yet. Please be honest with me.'],
};
export const SELF_CORRECTION: Bank = {
  calm: ['No problem.', "That's fine."],
  worried: ['Oh, that is fine.', 'Okay, no problem.'],
  firm: ['Okay.', 'Right.'],
  hot: ['Okay.', 'Right.'],
};
/** The engineer asked the customer to do something. The customer does not report a result. */
export const INSTRUCTION: Bank = {
  calm: ["Okay, I'll try that.", "Sure, I'll give that a go."],
  worried: ["Okay, I'll try that now.", "Okay, I'll do that."],
  firm: ["Fine, I'll try that.", "Okay, I'll do that."],
  hot: ["Fine, I'll try it.", 'Okay, I will.'],
};
export const INSTRUCTION_SIMPLE: Bank = {
  calm: ['Okay, I will try.'],
  worried: ['Okay, I will do that now.'],
  firm: ['Okay, I will try.'],
  hot: ['Okay, I will try.'],
};

export const ASSUMPTION_ACCEPTED: Bank = {
  calm: ["Oh, I hadn't thought of that. Okay."],
  worried: ["Oh. I didn't know that. Okay, that's a bit of a relief."],
  firm: ["Hm, I didn't realise that. Okay."],
  hot: ["Right. I didn't know that."],
};
export const ASSUMPTION_CHALLENGED: Bank = {
  calm: ["Well, I still think that's what it is, to be honest."],
  worried: ["I'm not sure. It just seems that way to me."],
  firm: ["That's still what it looks like to me."],
  hot: ["That's what it looks like from here."],
};

// ---------------------------------------------------------------------------------------
// What the stage of the call expects

export const KNOWS_CASE: Bank = {
  calm: ["Good, thanks. I wasn't sure you'd have the case in front of you."],
  worried: ["Oh good, you've seen the case. Thank you."],
  firm: ["Good. At least you know what's been going on."],
  hot: ["Okay. That's a start."],
};
export const UPDATE_GIVEN: Bank = {
  calm: ['Okay, thanks for the update.'],
  worried: ['Okay. Thank you for letting me know.'],
  firm: ["Right, thanks. That's the first proper update I've had."],
  hot: ['Okay. I needed to hear that.'],
};
export const ESCALATION_EXPLAINED: Bank = {
  calm: ['Okay, that helps me understand what happens next.'],
  worried: ['Okay. That helps, thank you.'],
  firm: ["Right. That's what I wanted to understand."],
  hot: ['Fine. At least I know what the escalation means now.'],
};
export const CADENCE: Bank = {
  calm: ['Okay, regular updates work for me.'],
  worried: ["Thank you, that helps. I'll look out for those updates."],
  firm: ["Good. I'll expect to hear from you on that schedule."],
  hot: ["Fine. I'll hold you to that schedule."],
};
export const RESOLUTION: Bank = {
  calm: ['Yes, it seems to be working fine now.'],
  worried: ["Yes, it's working now, as far as I can tell."],
  firm: ["Yes, it's working. I just want to know why."],
  hot: ["It's working now. I still want to know what happened."],
};
export const AGREEMENT_READY: Bank = {
  calm: ["Yes, I'm happy to close it."],
  worried: ["Yes, I think that's fine to close. Thank you."],
  firm: ["Yes, that's fine to close."],
  hot: ['Yes, you can close it. Just make sure it stays working.'],
};
export const AGREEMENT_WAITING: Bank = {
  calm: ["I'd like to understand what changed first."],
  worried: ["I'd just like to understand what changed first, if that's okay."],
  firm: ['Not until I understand what changed.'],
  hot: ["Not until I've been told what actually changed."],
};
export const CAUSE: Bank = {
  calm: ['Okay, that makes sense. Thank you for explaining.'],
  worried: ['Okay, I see. Thank you for explaining that.'],
  firm: ["Right. That's what I wanted to know."],
  hot: ["Okay. That's a proper answer, at least."],
};

// ---------------------------------------------------------------------------------------
// What the customer asks for when it has not been offered

export const PUSH_UPDATE: Bank = {
  calm: ['Can you tell me where things stand with the case?', 'Is there any news on the case yet?'],
  worried: [
    "Is there any update on the case? I'm getting a bit worried.",
    'Sorry to ask, but has there been any progress on the case?',
  ],
  firm: [
    "Where are we with the case? I haven't had an update.",
    'Has anything actually happened on the case?',
  ],
  hot: [
    'I need an update on the case. What is happening?',
    "What's actually been done on the case? I've had nothing.",
  ],
};
export const PUSH_HISTORY: Bank = {
  calm: [
    "Sorry, but have you seen what we've already been through on this?",
    'Have you had a chance to read the earlier notes?',
  ],
  worried: [
    "I just want to be sure you've seen the earlier calls.",
    'Sorry, but have you seen the notes from the earlier calls?',
  ],
  firm: [
    "Have you looked at the earlier calls? I don't want to start from scratch.",
    "Have you read the notes from before? I don't want to repeat myself.",
  ],
  hot: [
    "Have you read the earlier calls? I don't want to go over it all again.",
    "Did you read the notes? I'm not starting again.",
  ],
};
export const PUSH_ESCALATION: Bank = {
  calm: [
    'What does the escalation actually mean for us?',
    'Who has the case now that it has been escalated?',
  ],
  worried: [
    'Could you tell me what the escalation actually means for us?',
    "Who has the case now that it's been escalated?",
  ],
  firm: ['What does the escalation actually mean for us?', 'And who actually has the case now?'],
  hot: [
    'What does the escalation actually change? I need to know.',
    "Who has this now? That's what escalation is supposed to mean.",
  ],
};
export const PUSH_CADENCE: Bank = {
  calm: ['How often will I hear from you?', 'And how often can I expect an update?'],
  worried: [
    'How often will I hear from you? I would like to know when to expect it.',
    'Could you tell me how often I should expect to hear from you?',
  ],
  firm: ['How often will I hear from you on this?', 'And how often will you update me?'],
  hot: [
    'How often will I hear from you? I need a regular update.',
    'And how often will I get an update? I need a schedule.',
  ],
};
export const PUSH_CAUSE: Bank = {
  calm: ['So what was it that changed?', 'Could you tell me what actually caused it?'],
  worried: [
    "Could you tell me what it was that changed? I'd like to understand.",
    "Can you tell me what caused it? I'd really like to know.",
  ],
  firm: ['So what was it that changed?', 'What was the actual cause?'],
  hot: [
    'So what actually changed? That is why I called.',
    'What was the cause? I want a straight answer.',
  ],
};
export const PUSH_RESOLUTION: Bank = {
  calm: [
    "Before we close it, can we check it's definitely working?",
    "Could we just make sure it's really fixed first?",
  ],
  worried: [
    "Before we close it, can we make sure it's definitely working?",
    "Could we just check it's really fixed before we close it?",
  ],
  firm: [
    "Before we close it, I want to be sure it's actually working.",
    "Let's check that it really works before we close this.",
  ],
  hot: [
    "Before we close this, I want to know it's actually working.",
    "I'm not closing this until I know it's really fixed.",
  ],
};
export const PUSH_OWNER: Bank = {
  calm: ["Who's going to be looking after this from here?", 'And who do I speak to next time?'],
  worried: [
    "Can you tell me who's looking after this? I'd feel better knowing.",
    'Who should I speak to if I need to follow this up?',
  ],
  firm: ["Who's actually going to own this?", 'And who do I speak to if this goes quiet?'],
  hot: [
    'Who is taking ownership of this? I need a name.',
    "Give me one name. Who's responsible for this?",
  ],
};
/** A terse customer asks in a few words, whatever their mood. */
export const PUSH_SHORT: Record<PlanPush, string[]> = {
  timeline: ['When will I hear back?', 'When do I hear from you next?'],
  update: ['Any update on the case?', 'Where are we with the case?'],
  history: ['Have you read the earlier notes?', 'Have you seen the case history?'],
  escalation: ['Who has the case now?', 'What does the escalation change?'],
  cadence: ['How often will I hear from you?', 'How often do I get an update?'],
  cause: ['What actually changed?', 'What was the cause?'],
  resolution: ['Is it definitely working?', 'Can we check it works first?'],
  owner: ['Who is looking after this?', 'Who do I speak to?'],
};
export const TIMELINE: Bank = {
  calm: [
    'Do you have any idea how long this might take?',
    'Can you give me any idea when I might hear back?',
  ],
  worried: [
    'Do you know how long this might take? I do worry about it.',
    'Do you know when I might hear back? I keep worrying.',
  ],
  firm: [
    'I need a time frame. When will I hear from you?',
    'I need to know when I will hear from you.',
  ],
  hot: [
    'I need a time frame. When exactly will I hear back?',
    'When will I hear back? I need an actual time.',
  ],
};
export const TIMELINE_SIMPLE: Bank = {
  calm: ['How long will this take?'],
  worried: ['How long will this take? I am worried.'],
  firm: ['I need a time. When will I hear from you?'],
  hot: ['I need a time. When exactly will I hear from you?'],
};

// ---------------------------------------------------------------------------------------
// Personality: a line of their own, not a reply to the last message

export const FLAVOUR_TIMELINE_WORRY: Bank = {
  calm: ['How long do you think this will take?', 'Do you know roughly how long it will take?'],
  worried: [
    "How long do you think this will take? I can't help worrying.",
    'Do you know how long it will take? I keep thinking about it.',
  ],
  firm: ['How long is this likely to take?', 'Roughly how long are we talking?'],
  hot: ['How long is this going to take?', 'How long are we talking here?'],
};
export const FLAVOUR_IMPACT_WORRY: Bank = {
  calm: [
    "I'm a bit worried about what this means for the team.",
    "I'm a little worried about the knock-on for the team.",
  ],
  worried: [
    "I'm worried about what this is doing to us. Will it get worse?",
    "I'm worried this will get worse for us.",
  ],
  firm: [
    "I'm worried about what this means for us.",
    "I'm concerned about what this is doing to us.",
  ],
  hot: [
    'I need to know what this is going to cost us.',
    'This is costing us. I need to know where it ends.',
  ],
};
export const FLAVOUR_URGENCY: Bank = {
  calm: [
    "Just so you know, it's quite urgent for us.",
    'It is fairly urgent on our side, so I would appreciate speed.',
  ],
  worried: [
    "I just want to stress that it's urgent for us.",
    "I'm sorry to press, but it really is urgent.",
  ],
  firm: ["Just so it's clear, this is urgent for us.", "I'll say again that this is urgent."],
  hot: [
    'This is urgent. I need you to understand that.',
    "I can't stress enough how urgent this is.",
  ],
};
export const FLAVOUR_NO_PROGRESS: Bank = {
  calm: ["We haven't made much progress so far.", "I don't feel we've got very far yet."],
  worried: [
    "I'm worried we haven't made much progress.",
    "I'm a bit worried we haven't got very far.",
  ],
  firm: ["We've been going round in circles on this.", "We don't seem to be getting anywhere."],
  hot: [
    "I haven't seen any progress at all on this.",
    "We're getting nowhere, and I'm running out of patience.",
  ],
};
export const FLAVOUR_CHALLENGE: Bank = {
  calm: [
    "I'd like something firmer than that, if possible.",
    'Could you be a little more specific?',
  ],
  worried: [
    "Sorry, but that doesn't tell me much. Can you be more specific?",
    'Sorry, but could you tell me exactly what happens next?',
  ],
  firm: [
    "That's not much of an answer. Who's doing what, and by when?",
    "That's still vague. Who's doing what, and when?",
  ],
  hot: [
    "That's not good enough. Who exactly is doing what, and by when?",
    "That's still not specific. Name the person and the time.",
  ],
};
export const FLAVOUR_ESCALATE: Bank = {
  calm: [
    "If you can't help with this, I'd like it escalated.",
    'Would it be possible to escalate this?',
  ],
  worried: [
    "If you can't help, could this be escalated, please?",
    "Would it help to escalate this? I'd feel better.",
  ],
  firm: ["If you can't help with this, I'd like it escalated.", 'I think this needs escalating.'],
  hot: [
    "If you can't sort this out, I want it escalated.",
    'Escalate this. I want someone senior on it.',
  ],
};
export const FLAVOUR_PLAN: Bank = {
  calm: [
    "What's the plan, and when will I hear from you?",
    'Could you tell me the plan and the next step?',
  ],
  worried: ["What's the plan? When will I hear from you?", 'Could you tell me the plan, please?'],
  firm: [
    "What's the plan, and when will I hear from you?",
    "I'd like to hear the plan and a time for it.",
  ],
  hot: ["I need a plan and a time. What's happening next?", 'Give me a plan and a time. Now.'],
};
export const FLAVOUR_ASSURANCE: Bank = {
  calm: [
    "I'd just like to be sure it won't come back.",
    'I just want to be sure this is properly sorted.',
  ],
  worried: [
    "I just want to be sure it won't happen again. I'd hate to be back on the phone next week.",
    "Can you be sure it's properly fixed? I keep worrying it will come back.",
  ],
  firm: [
    'What makes sure this does not happen again?',
    'I want to know it will not come back, not just that it works today.',
  ],
  hot: [
    "I want to know this won't happen again.",
    "I'm not happy to close this until I know it won't come back.",
  ],
};

export const OFF_ROLE: Bank = {
  calm: [
    "Sorry, I'm not sure what you mean. I'm just here about my problem.",
    "I'm sorry, I'm not following. I just need help with my problem.",
  ],
  worried: [
    "I'm sorry, I don't understand. Can we get back to my problem?",
    "I'm sorry, I don't follow. Can we go back to my problem?",
  ],
  firm: [
    "I don't know what you're talking about. Can we get back to my problem?",
    "I'm not sure what you mean. Can we get back to my problem?",
  ],
  hot: [
    "I don't know what you're talking about. Let's get back to my problem.",
    "I've no idea what you're on about. Back to my problem.",
  ],
};
export const LOW_EFFORT: Bank = {
  calm: ['Sorry, are you still there?', 'Hello? Was there something you wanted to ask?'],
  worried: ['Hello? Are you still there?'],
  firm: ['Hello? Are you still there?'],
  hot: ['Hello? Is anyone there?'],
};

export const DONT_KNOW: Record<'novice' | 'intermediate' | 'expert', string[]> = {
  novice: [
    "I'm not sure, to be honest.",
    "I don't know, sorry. I'm not the technical person.",
    "I don't have that to hand, sorry.",
  ],
  intermediate: [
    "I'm not sure about that.",
    "I haven't checked that, I'm afraid.",
    "I don't have that to hand.",
  ],
  expert: [
    "I haven't looked into that.",
    "Not that I'm aware of.",
    "I don't have that in front of me.",
  ],
};
export const DONT_KNOW_SIMPLE: string[] = [
  'I am not sure about this.',
  'I do not know this, sorry.',
  'I do not have this information now.',
];

export const WITHHOLD_TRUST: Bank = {
  calm: [
    "I'd rather not get into that just yet, if that's okay.",
    "I'd prefer to leave that for now, if you don't mind.",
  ],
  worried: [
    "I'm not sure I'm ready to go into that yet. Sorry.",
    "I'd rather not go into that yet, sorry.",
  ],
  firm: [
    "I'm not sure I want to get into that until I know this is going somewhere.",
    "I'm not ready to go into that yet.",
  ],
  hot: [
    "I'm not going into that until I know you're actually going to fix this.",
    'Not until I trust this is going somewhere.',
  ],
};
export const WITHHOLD_IMPACT: Bank = {
  calm: [
    "Before we go into that, I'd like to know you understand how serious this is for us.",
    "I'd like to be sure you understand what's at stake first.",
  ],
  worried: [
    'Before I go into that, can I be sure you understand how serious this is for us?',
    'Could you tell me you understand how much this matters first?',
  ],
  firm: [
    'Before we go into that, I want to know you understand how serious this is.',
    'First I want to hear that you understand what this means for us.',
  ],
  hot: [
    'Before we go anywhere near that, I want to hear that you understand how serious this is.',
    "First tell me you understand what's at stake here.",
  ],
};

export const SILENT: Bank = {
  calm: ['Hm.', "Sorry, I'm just thinking."],
  worried: ['Hm...', "Sorry. I'm just thinking."],
  firm: ['...', 'Hm.'],
  hot: ['...', 'Hm.'],
};
export const RE_ENGAGED: Bank = {
  calm: ["Sorry. I'm still here."],
  worried: ["Sorry. I'm still here. I'm just worried."],
  firm: ["Sorry. I'm still here."],
  hot: ["Yes. I'm here."],
};

export const PROMPT: Bank = {
  calm: ['So, what happens now?', 'What would you suggest I do next?'],
  worried: ['Is this going to be okay?', 'Do you have any idea what might be going on?'],
  firm: ['So what are you going to do about it?', 'What happens next?'],
  hot: [
    'So what are you actually going to do about it, and when?',
    'I need to know what happens next.',
  ],
};
export const PROMPT_SIMPLE: Bank = {
  calm: ['What happens now?', 'What is the next step?'],
  worried: ['Will this be okay?', 'What is the next step?'],
  firm: ['What will you do now?', 'What is the next step?'],
  hot: ['What will you do now, and when?', 'I need to know the next step.'],
};

// ---------------------------------------------------------------------------------------
// Closing the call

export const CLOSING_CUSTOMER: Bank = {
  calm: ["No, I think that's everything. Thank you for your help.", "That's all from me. Thanks."],
  worried: ["I think that's everything. Thank you, I feel better."],
  firm: ["No, that's everything. Thank you.", "That's all. I'll wait to hear from you."],
  hot: ["That's everything for now. I'll expect to hear from you."],
};
export const CLOSING_CUSTOMER_SIMPLE: Bank = {
  calm: ['No, that is everything. Thank you for your help.'],
  worried: ['That is everything. Thank you, I feel better.'],
  firm: ['That is everything. Thank you.'],
  hot: ['That is everything for now. I will wait.'],
};
// Used when the reply already thanked the engineer, so the customer does not do it twice.
export const CLOSING_CUSTOMER_NO_THANKS: Bank = {
  calm: ["No, I think that's everything.", "That's all from me."],
  worried: ["I think that's everything, and I feel better about it."],
  firm: ["No, that's everything.", "That's all. I'll wait to hear from you."],
  hot: ["That's everything for now. I'll expect to hear from you."],
};
export const CLOSING_CUSTOMER_NO_THANKS_SIMPLE: Bank = {
  calm: ['No, that is everything.'],
  worried: ['That is everything. I feel better.'],
  firm: ['That is everything.'],
  hot: ['That is everything for now. I will wait.'],
};
/** The customer closes the call by saying back what they have been promised. */
export const CLOSING_WITH_COMMITMENT: Bank = {
  calm: ["That's everything, thanks. So you'll {x}.", "No, that's all. So you'll {x}. Thank you."],
  worried: ["I think that's everything. So you'll {x}. Thank you."],
  firm: ["That's everything. So you'll {x}."],
  hot: ["That's everything for now. So you'll {x}, and I'll expect that."],
};
/** And the customer remembers what they offered to do. */
export const CLOSING_CUSTOMER_CHECK = "And I'll ask {who} and let you know.";

// ---------------------------------------------------------------------------------------
// Chat that is not about the problem (talkative customers). A scenario's own irrelevant facts are
// used first; these are for scenarios that have none.

export const TANGENTS: Bank = {
  calm: [
    "It's been one of those mornings, honestly.",
    'I did wonder whether it was something I had done.',
    "I don't usually have trouble with this sort of thing.",
    'Everything else seems to be working fine, which is odd.',
    "I'd rather not hold anyone up.",
  ],
  worried: [
    "I've been going round in circles about this.",
    'I keep thinking I must have done something wrong.',
    "I didn't sleep well thinking about it, to be honest.",
    "I just don't want to make it worse.",
    "I'm trying not to panic about it.",
  ],
  firm: [
    "And this isn't the first thing that's gone wrong this week.",
    "I've already lost a fair bit of time on this.",
    'I would have thought this would be simple to sort out.',
    "We've got a lot on today, so this really isn't helping.",
    'I did try to sort it out myself before calling.',
  ],
  hot: [
    'And honestly, this is the last thing I needed today.',
    "I've wasted most of the morning on this already.",
    "I shouldn't have to keep chasing this.",
    'This keeps getting in the way of everything else.',
    "I'm running out of patience with all of this.",
  ],
};

export const VAGUE_ANSWERS: string[] = [
  "It's hard to say, really.",
  "I'm not sure exactly. It's sort of off.",
  "It just doesn't seem to be working properly, I think.",
  "It's difficult to explain. It's just not right.",
];

/** Light fillers. A customer uses one now and then, never in every reply. */
export const FILLERS: string[] = ['Well,', 'So,', 'Right,', 'Um,', 'Let me think.'];
