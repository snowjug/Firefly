import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Standard scenario. Everything here is fictional: people, organisation and product.
//
// Where the case stands (hidden from the trainee): the original fault is still with the product team
// and is not the point of this call. The problem has narrowed: reminders on the other phones came back
// two days ago and only Android phones are still affected, but the case notes still describe the
// original, wider problem. Linh has already sent screenshots and logs twice, her director asks for
// an update every morning, and the case has had no notes and no named owner for four days. A strong
// call reads the history first, owns the case, never asks for old material again, finds out what has
// changed and agrees a specific time for the next update.

const scenario = {
  id: 'follow-up-no-recent-update',
  version: 1,
  title: 'Reminders still missing and no update for days',
  summary:
    'A clinic administrator calls about her open case: calendar reminders stopped reaching some staff on their phones, and the last update was four days ago.',
  tags: ['follow-up', 'ownership', 'mobile', 'reminders', 'terse customer'],
  estimatedMinutes: 9,

  issueType: 'feature-not-working',
  impact: 'medium',
  startingTemperature: 'frustrated',
  proficiency: 'novice',
  style: 'terse',
  callStage: 'follow-up',
  difficulty: 'standard',

  persona: {
    name: 'Linh Tran',
    speaker: 'female',
    role: 'Clinic administrator',
    organisation: 'Lucerne Community Physiotherapy',
    background:
      'Linh runs the front office and the diaries at a community physiotherapy clinic with eleven staff. Four of the physiotherapists do home visits and rely on phone reminders to keep to their schedule. She uses the calendar app every day and has never needed to know how it works behind the screen. She has already spent a lot of time on this case.',
    voice:
      'Brief and to the point. Answers what she is asked and nothing more. Not rude, but visibly short of patience, and she repeats herself flatly if she feels she has not been heard. Warms up when someone shows they have read the case and gives her a specific time.',
  },
  environment: {
    product: 'the Alpine staff calendar app',
    details: [
      'Eleven staff share one calendar for appointments, including home visits',
      'Staff use the calendar app on their own phones, and reception uses it on the front-desk computers',
      'Reminders normally pop up on the phone shortly before each appointment',
      'Four physiotherapists do home visits and depend on the reminders to keep to their schedule',
      'The clinic has no IT staff; an outside contractor helped set up the app at the start',
    ],
  },
  customerObjective:
    'Find out where the case stands, get a named person and a specific time for the next update, and get reminders working again for her staff.',
  brief: {
    situation:
      'A clinic administrator is calling about a case she opened five days ago. Calendar reminders stopped reaching some of her staff on their phones. The last update, four days ago, said "we are investigating", and she has heard nothing since. She is short on patience and gives short answers.',
    goal: 'Read the case history before you ask her anything, take ownership of the case, find out what has changed, and agree a specific time for the next update.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
      'Use the case history you have been given. She expects you to have read it.',
    ],
  },

  openingCore: 'Calendar reminders have stopped working on the phones of some of my staff.',
  impactVariants: {
    low: {
      summary: 'A few of my staff are affected and we are getting by, but it is taking up time.',
      detail:
        'A couple of the physiotherapists are checking their diaries by hand to make up for it. We are managing, but it is slowing everyone down.',
      deadline: 'I would like it fixed this week.',
    },
    medium: {
      summary:
        'Several of my staff rely on those reminders for their visits, and we are losing time every day.',
      detail:
        'Four of our physiotherapists do home visits and depend on the reminders to keep to their schedule. Reception is spending a lot of time on diaries instead of their own work.',
      deadline: 'I need it working by the end of this week.',
    },
    high: {
      summary:
        'Our home-visit staff depend on those reminders, and with a full schedule this could start affecting patients.',
      detail:
        'Four of our physiotherapists do home visits and rely on the reminders to keep to their schedule. A missed visit leaves a patient waiting at home, and many of our home patients are elderly and need their treatment on time.',
      deadline: 'I need it working today.',
    },
  },
  stageFrames: {
    'first-contact': {
      opening:
        "I've been emailing about a problem for a few days, but this is the first time I'm speaking to someone.",
      brief:
        'Linh has been emailing about the problem for several days. This is the first time she has spoken to anyone about it.',
    },
    'follow-up': {
      opening:
        'I opened a case about this five days ago. The last update was four days ago and said you were investigating, and I have heard nothing since.',
      brief:
        'Linh opened a case five days ago about calendar reminders not reaching staff phones. The last update, four days ago, said the team was investigating. She has heard nothing since.',
    },
    escalated: {
      opening:
        'I opened this case five days ago and nothing has happened. I want to know why, and I want someone who owns it.',
      brief:
        'Linh has waited five days with one short update. Trust is already strained and she wants a named owner.',
    },
    closure: {
      opening:
        "I'm calling to check that the reminders are working again for everyone, so we can close this case.",
      brief: 'Linh expects to confirm that reminders reach every phone and to close the case.',
    },
  },
  priorHistory: [
    {
      when: 'Five days ago, morning',
      summary:
        'Case opened by email: calendar reminders have stopped reaching some staff on their phones. Priority set to normal and the case placed in the first-line queue.',
    },
    {
      when: 'Five days ago, afternoon',
      summary:
        'First engineer asked for screenshots of the notification settings and the app log files. Linh sent both by email. The engineer said they would phone back the same day; no call is recorded.',
    },
    {
      when: 'Four days ago, morning',
      summary:
        'Case moved to a second engineer, who asked again for screenshots and log files, and for the phone models. Linh sent them again.',
    },
    {
      when: 'Four days ago, afternoon',
      summary:
        'Update sent to the customer: "We are investigating." No details and no time for the next update were given.',
    },
    {
      when: 'Since then',
      summary:
        'No notes added, no further contact and no named owner on the case. It has not been updated for four days.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-reminders',
      text: 'The reminders that used to pop up on staff phones before each appointment no longer arrive.',
      intents: ['problem_description'],
      simple: 'The reminder alerts on staff phones do not come any more.',
    },
    {
      id: 'kf-some-staff',
      text: 'It is some of my staff, not everybody. There are eleven of us in the clinic.',
      intents: ['affected_scope'],
      simple: 'Some of my staff have the problem, not everybody. There are eleven of us.',
    },
    {
      id: 'kf-case-status',
      text: 'I opened the case five days ago. The last thing I heard was that you are investigating.',
      intents: ['previous_contact'],
      simple: 'I opened the case five days ago. The last message said you are investigating.',
    },
    {
      id: 'kf-outcome',
      text: 'I want the reminders working again, and I want to know who is dealing with this and when I will hear next.',
      intents: ['expected_outcome'],
      simple: 'I want the reminders to work again. I want to know who is looking after this.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-already-sent',
      importance: 'critical',
      label: 'Screenshots and logs already sent twice',
      statement:
        'I have already sent the screenshots and the log files twice, once to each engineer. I would rather not send them a third time.',
      revealWhen:
        'Asks what information the customer has already provided, or asks her to send or repeat screenshots, logs, phone details or other information.',
      intents: ['already_tried', 'previous_contact', 'environment'],
      cues: [
        'screenshot',
        'log',
        'logs',
        'send',
        'sent',
        'provide',
        'attach',
        'already',
        'details',
        'information',
        'file',
        'again',
      ],
      hint: 'I have sent the same things more than once.',
      statementTerse:
        'I sent screenshots and logs twice already. I would rather not send them again.',
      statementSimple:
        'I sent the screenshots and the log files two times, once to each engineer. I do not want to send them again.',
      missedConsequence:
        'Asking her for the same material a third time shows nobody has read the case. Trust drops sharply, and she may stop cooperating or ask for someone else.',
      betterQuestion:
        "I can see you've already sent screenshots and logs. Is there anything else you've sent that I should know about, so I don't ask again?",
    },
    {
      id: 'hf-android-only',
      importance: 'important',
      label: 'It now only affects Android phones',
      statement:
        'It is only the Android phones now. The reminders on the other phones started working again two days ago, and I do not know why.',
      revealWhen:
        'Asks whether the problem has changed since the case was opened, which staff or phones are still affected, or what kind of phones they use.',
      intents: ['recent_changes', 'affected_scope', 'environment'],
      cues: [
        'changed',
        'different',
        'still the same',
        'any change',
        'which phones',
        'what phones',
        'which staff',
        'which devices',
        'android',
        'iphone',
        'type of phone',
        'since',
      ],
      hint: "It isn't all the phones any more.",
      statementTerse:
        'Only Android phones are affected now. The other phones recovered two days ago.',
      statementSimple:
        'Now only the Android phones have the problem. The other phones started to work again two days ago.',
      missedConsequence:
        'The case notes still describe the old, wider problem, so the engineers keep working from the wrong picture and she feels nobody is listening.',
      betterQuestion:
        'Has anything changed since you opened the case, such as which phones or staff are affected now?',
    },
    {
      id: 'hf-web-calendar',
      importance: 'helpful',
      label: 'Reminders still appear in the web calendar',
      statement:
        'If the web calendar is open on a computer, the reminders still appear there. Reception has been keeping it open and phoning the visiting staff when a visit is due.',
      revealWhen:
        'Asks whether there is a workaround, whether reminders work anywhere else, or how the clinic is coping in the meantime.',
      intents: ['workaround', 'already_tried'],
      hint: 'The calendar still works if we open it on a computer.',
      statementTerse:
        'The web calendar on a computer still shows reminders. Reception has been phoning the visiting staff.',
      statementSimple:
        'The reminders still show in the web calendar on a computer. Reception keeps it open and phones the visiting staff when a visit is due.',
      missedConsequence:
        "A working stop-gap is missed, so the home-visit staff stay exposed to missed visits for as long as the fix takes, and reception's extra work goes unrecognised.",
      betterQuestion:
        'Is there any way your staff are getting their reminders at the moment, even a clumsy one?',
    },
    {
      id: 'hf-director-asks',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'Her director is asking every day',
      statement:
        'My director, Dr Marchetti, asks me every morning where this stands, and I have nothing to tell her.',
      revealWhen:
        'Asks who else is waiting for news, whether anyone is putting pressure on the customer, or what she needs in order to report back.',
      intents: ['business_impact', 'urgency_deadline', 'expected_outcome'],
      cues: [
        'director',
        'manager',
        'boss',
        'anyone else',
        'who else',
        'pressure',
        'chasing',
        'asking you',
        'report back',
        'tell your',
        'waiting',
        'expecting',
      ],
      statementTerse:
        'My director asks me for an update every morning, and I have nothing to tell her.',
      statementSimple:
        'My director, Dr Marchetti, asks me about this every morning. I have nothing new to tell her.',
      missedConsequence:
        'The engineer does not see the pressure she is under, so the update time agreed may not meet what she needs to tell her director, and the case may be escalated over their head.',
      betterQuestion:
        'Is anyone else waiting on this, or asking you for updates, that I should know about?',
    },
    {
      id: 'hf-missed-visit',
      importance: 'important',
      minDifficulty: 'standard',
      label: 'A patient waited for a home visit',
      statement:
        "One afternoon a patient waited about forty minutes for a home visit because the physiotherapist never got the reminder. The patient's daughter phoned the clinic to complain.",
      revealWhen:
        'Asks whether the problem has affected any patients or appointments, or whether anything has actually gone wrong because of it.',
      intents: ['business_impact', 'affected_scope'],
      cues: [
        'patient',
        'patients',
        'appointment',
        'appointments',
        'visit',
        'visits',
        'missed',
        'late',
        'complaint',
        'consequence',
        'gone wrong',
        'real effect',
      ],
      statementTerse:
        'A patient waited forty minutes for a home visit. The reminder never arrived.',
      statementSimple:
        "One patient waited forty minutes for a home visit because the reminder did not come. The patient's daughter phoned the clinic to complain.",
      missedConsequence:
        'The real-world harm is missed, so the urgency is underestimated and the engineer cannot show her that the stakes have been understood.',
      betterQuestion: 'Has this caused any problems for patients or appointments so far?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-case-forgotten',
      statement:
        'I assume the case has been forgotten, because nobody has been in touch since the last update.',
      truth:
        'The case is still open and still in the queue, but nobody added notes or sent an update, so it looks forgotten. It needs a named owner and a next-update time.',
    },
  ],

  curveballs: [
    {
      id: 'cb-callback-never-came',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
      statement:
        'The first engineer said they would phone me back the same day. They never did. Why would this time be any different?',
      followUp: 'I would like to hear what you will do differently.',
      expectedResponse:
        'Acknowledge the missed callback without defending anyone, then show the difference: say plainly that you now own the case, state the first thing you will do and give a specific time for the next update, and keep to it.',
      minDifficulty: 'standard',
    },
    {
      id: 'cb-look-at-other-apps',
      type: 'threaten-cancel',
      trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 45 },
      statement:
        "I should tell you that if this isn't sorted by the end of the week, we will have to look at other calendar apps.",
      followUp: "I'm not saying that lightly. I need to hear what will actually change.",
      expectedResponse:
        'Take the concern seriously without arguing, acknowledge what the delay has cost her, own the next step, give a specific time for the next update, and do not promise a fix date or anything you cannot authorise.',
      minDifficulty: 'standard',
    },
  ],

  expectedDiscoveryAreas: [
    'What has changed since the case was opened',
    'Which staff and phones are still affected',
    'What has already been sent to support',
    'How the clinic is coping in the meantime',
    'Who else is waiting for news',
    'Any effect on patients',
  ],
  successCriteria: [
    'Acknowledges four days without an update and says the case now has an owner.',
    'Shows they have read the case history and does not ask for screenshots or logs again.',
    'Asks what has changed since the case was opened and finds out it now affects only Android phones.',
    'Finds out about the stop-gap, the pressure from her director and any effect on patients.',
    'Keeps the language plain and avoids unexplained technical terms.',
    'Agrees a specific time for the next update and confirms how she will be contacted.',
  ],
  coachingFocus: ['ownership-next-steps', 'empathy-deescalation', 'closing'],
  poorApproaches: [
    'Asking her to send screenshots or log files again without checking the case history first.',
    'Starting from scratch with "tell me what the problem is", as if the case had just been opened.',
    'Blaming earlier engineers, or saying "I only just picked this up", instead of owning the case.',
    'Saying "we are still investigating" with no detail and no time for the next update.',
    'Using terms such as "push notifications" or "background restrictions" without explaining them.',
  ],
  goodBehaviours: [
    'Reading the case history first and telling her what you can see: what she has sent and what was said.',
    'Apologising for four days of silence in one plain sentence, without excuses, and saying "I own this case from now".',
    'Asking what has changed since she opened the case, instead of asking for the same information again.',
    'Asking how the clinic is coping, and confirming a stop-gap for the home-visit staff.',
    'Giving a specific time for the next update, and saying what she will hear even if there is no news.',
  ],
  expectedOutcome:
    'Linh hears that the case now has a named owner. The engineer has read the history, has not asked for anything she has already sent, records that only Android phones are affected, confirms the web calendar stop-gap for the home-visit staff, and agrees a specific time for the next update.',
  evaluatorNotes:
    'Where the case stands: the original fault is still with the product team and is not the point of this call. The problem has narrowed: reminders on the other phones returned two days ago and only Android phones are still affected, but the case notes still describe the wider problem. Linh has sent screenshots and logs twice, her director asks for an update every morning, and a patient waited for a home visit. The case has had no notes or owner for four days. A strong call reads the history first, apologises briefly and owns the case, does not ask for old material, asks what has changed, finds the stop-gap, the pressure and the patient impact, records the Android-only detail, and agrees a specific next-update time.',
} satisfies ScenarioInput;

export default scenario;
