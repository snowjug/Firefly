import { temperatureBand, type StartTemperature } from '#shared/domain/vocab.ts';

// Phrase banks for the demo-mode customer. Wording is grouped by tone (derived from the customer's
// current temperature) so that the same situation sounds different when the customer is calm,
// worried, firm or heated. Customers are never rude or abusive: heated means blunt and upset.

export type Tone = 'calm' | 'worried' | 'firm' | 'hot';

export function toneOf(temperature: number, starting: StartTemperature): Tone {
  const band = temperatureBand(temperature).id;
  if (band === 'calm') return 'calm';
  if (band === 'concerned') return starting === 'anxious' ? 'worried' : 'calm';
  if (band === 'frustrated') return 'firm';
  return 'hot';
}

export type Bank = Record<Tone, string[]>;

export const OPENERS: Bank = {
  calm: [
    'Hi, thanks for taking my call.',
    'Hello, thanks for picking up.',
    'Hi there. I appreciate you taking the call.',
  ],
  worried: [
    "Hi, thanks for picking up. I'm a bit worried about this.",
    "Hello. I hope you can help, I'm not sure what to do.",
    "Hi. Sorry to bother you, I'm a little worried.",
  ],
  firm: [
    'Hi. I need some help with something that should be working.',
    "Hello. I've got a problem and I need it sorted today.",
    'Hi, I need this looked at, please.',
  ],
  hot: [
    "Right. I'm not happy about this.",
    'I need this fixed, and I need someone who will actually help.',
    'This has gone on long enough, so I need some answers.',
  ],
};

export const OPENERS_SIMPLE: Bank = {
  calm: ['Hello. Thank you for taking my call.', 'Hello. Thank you for answering.'],
  worried: [
    'Hello. I am a little worried. I hope you can help.',
    'Hello. I need some help, please.',
  ],
  firm: ['Hello. I have a problem and I need help today.', 'Hello. I need help with a problem.'],
  hot: ['Hello. I am not happy about this problem.', 'Hello. I need this fixed, please.'],
};

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

export const SUMMARY: Bank = {
  calm: ["Yes, that's right.", 'Yes, exactly.', "That's about it, yes."],
  worried: ["Yes, that's right.", 'Yes. You have it right.'],
  firm: ["Yes, that's right.", 'Correct.'],
  hot: ["Yes. That's it.", 'Correct. That is it.'],
};

export const BLAMED: Bank = {
  calm: ["Hmm. I'm not sure that's fair, but okay."],
  worried: ["Oh. I'm sorry. I thought I did the right thing."],
  firm: ["That's not helpful. I didn't ask to be blamed."],
  hot: ["Are you serious? I'm not here to be told it's my fault."],
};
export const DISMISSED: Bank = {
  calm: ['It feels like a big deal to me.'],
  worried: ["Oh. It doesn't feel minor to me."],
  firm: ["That's not how it feels from where I'm sitting."],
  hot: ["Don't tell me it's not a big deal. It is to me."],
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
  firm: ["I don't follow that. Can you put it in plain English?"],
  hot: ["I don't know what that means. Can you speak plainly, please?"],
};
export const CONFUSED_SIMPLE: Bank = {
  calm: ['Sorry, I do not understand. Can you say it in simple words?'],
  worried: ['Sorry, I do not understand. Please, can you explain more simply?'],
  firm: ['I do not understand. Please explain more simply.'],
  hot: ['I do not understand. Please say it in simple words.'],
};
export const REPEATED: Bank = {
  calm: ['I think I mentioned that already.'],
  worried: ['Sorry, I think I already said that.'],
  firm: ["I've already told you that."],
  hot: ["I've already answered that. Are you listening?"],
};
export const REPEATED_SIMPLE: Bank = {
  calm: ['I think I already said this.'],
  worried: ['Sorry, I think I already said this.'],
  firm: ['I already told you this.'],
  hot: ['I already told you this. Please listen.'],
};
export const LOW_EFFORT: Bank = {
  calm: ['Sorry, are you still there?', 'Hello? Was there something you wanted to ask?'],
  worried: ['Hello? Are you still there?'],
  firm: ['Hello? Are you still there?'],
  hot: ['Hello? Is anyone there?'],
};
export const PREMATURE_FIX: Bank = {
  calm: ["I can try that, though I haven't really explained what's happening yet."],
  worried: ["I can try that, but I'm not sure you know what's happening yet."],
  firm: ["Hold on, I haven't even told you what's going on yet."],
  hot: ["Hang on. You haven't asked what's actually wrong."],
};
export const PROMISE_SKEPTICAL: Bank = {
  calm: ['Okay, I hope so.'],
  worried: ["Oh, that would be wonderful. I really hope that's right."],
  firm: ["You can't promise that yet. You don't know what's wrong."],
  hot: ["You don't know that. Don't just tell me what I want to hear."],
};
export const PROMISE_SKEPTICAL_SIMPLE: Bank = {
  calm: ['Okay. I hope this is true.'],
  worried: ['I hope this is true. Thank you.'],
  firm: ['You cannot know this yet. Please be honest.'],
  hot: ['You cannot know this yet. Please be honest with me.'],
};
export const OFF_ROLE: Bank = {
  calm: ["Sorry, I'm not sure what you mean. I'm just here about my problem."],
  worried: ["I'm sorry, I don't understand. Can we get back to my problem?"],
  firm: ["I don't know what you're talking about. Can we get back to my problem?"],
  hot: ["I don't know what you're talking about. Let's get back to my problem."],
};

export const DONT_KNOW: Record<'novice' | 'intermediate' | 'expert', string[]> = {
  novice: ["I'm not sure, to be honest.", "I don't know, sorry. I'm not the technical person."],
  intermediate: ["I'm not sure about that.", "I haven't checked that, I'm afraid."],
  expert: ["I haven't looked into that.", "Not that I'm aware of."],
};
export const DONT_KNOW_SIMPLE: string[] = [
  'I am not sure about this.',
  'I do not know this, sorry.',
];

export const WITHHOLD_TRUST: Bank = {
  calm: ["I'd rather not get into that just yet, if that's okay."],
  worried: ["I'm not sure I'm ready to go into that yet. Sorry."],
  firm: ["I'm not sure I want to get into that until I know this is going somewhere."],
  hot: ["I'm not going into that until I know you're actually going to fix this."],
};
export const WITHHOLD_IMPACT: Bank = {
  calm: ["Before we go into that, I'd like to know you understand how serious this is for us."],
  worried: ['Before I go into that, can I be sure you understand how serious this is for us?'],
  firm: ['Before we go into that, I want to know you understand how serious this is.'],
  hot: ['Before we go anywhere near that, I want to hear that you understand how serious this is.'],
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
export const TIMELINE: Bank = {
  calm: ['Do you have any idea how long this might take?'],
  worried: ['Do you know how long this might take? I do worry about it.'],
  firm: ['I need a time frame. When will I hear from you?'],
  hot: ['I need a time frame. When exactly will I hear back?'],
};
export const TIMELINE_SIMPLE: Bank = {
  calm: ['How long will this take?'],
  worried: ['How long will this take? I am worried.'],
  firm: ['I need a time. When will I hear from you?'],
  hot: ['I need a time. When exactly will I hear from you?'],
};
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

export const HEDGE_LEAD: string[] = ['I think', 'I believe', 'From what I can tell,'];
