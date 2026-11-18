import type { ScenarioInput } from '#shared/domain/scenario.ts';

// Starter scenario. Everything here is fictional: people, organisation and product.
//
// Root cause (hidden from the trainee): since a layout update, Export is no longer a button on
// the invoice list. It now lives in the Share menu. Carmen's browser window fills only half of her
// screen, so the toolbar collapses and Share sits behind a three-dot icon that she has not opened.
// She is also following a training PDF that describes the old layout. A strong call finds out what
// she is trying to do, checks what she can actually see before giving any steps, and then guides
// her one step at a time.

const scenario = {
  id: 'cannot-find-export-feature',
  version: 1,
  title: 'A user needs help finding a feature',
  summary:
    'An accounts assistant cannot find the Export option on the invoices page and asks where it is.',
  tags: ['how-to', 'export', 'single user'],
  estimatedMinutes: 7,

  issueType: 'how-to',
  impact: 'low',
  startingTemperature: 'calm',
  proficiency: 'novice',
  style: 'terse',
  callStage: 'first-contact',
  difficulty: 'starter',

  persona: {
    name: 'Carmen Fraser',
    role: 'Accounts assistant',
    organisation: 'Tailspin Print Works',
    background:
      'Carmen keeps the supplier and customer invoices up to date in the back office. She knows her daily routine well and rarely uses anything outside it. She prefers clear instructions and does not like to click around without knowing what will happen.',
    voice:
      'Polite and brief. Answers exactly what she is asked, then waits for the next question. Does not offer background unless asked. Describes what she sees in her own words instead of using the names of things.',
  },
  environment: {
    product: 'the Fabrikam invoice manager',
    details: [
      'Invoice list opened in a web browser on a work laptop',
      'The browser window fills only half of the screen, with another program open beside it',
      'In the current layout Export is in the Share menu, next to Print and Copy link',
      'On a narrow window the toolbar collapses and Share sits behind a three-dot icon at the top right',
      'Export saves what the list is currently showing, so the date range matters',
      'Her training PDF shows an older layout, with an Export button at the top right of the list',
      "She needs last month's invoices in a spreadsheet for a meeting at 2 pm",
    ],
  },
  customerObjective:
    'Find the Export option and get what she needs out of the invoice list without having to ask again.',
  brief: {
    situation:
      'An accounts assistant is calling because she cannot find the Export option on the invoices page. She is calm and polite, and her answers are short.',
    goal: 'Find out what she is trying to do and what she can see, then guide her to the Export option one step at a time.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Product note: since the last layout update, Export is in the Share menu on the invoices page. It saves what the list is currently showing.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },

  openingCore: "I can't find the Export button on the invoices page. Can you tell me where it is?",
  impactVariants: {
    low: {
      summary: "It's only me, and I can carry on with other work for now.",
      detail:
        "As far as I know it's only me. I haven't asked anyone else, and I can do other work while I look.",
      deadline: 'I would like to sort it out today, if possible.',
    },
    medium: {
      summary: 'Two of us in accounts need it, and neither of us can find it.',
      detail:
        "A colleague in accounts needs the same thing and can't find it either. We can still do other work, but it's holding up a job we both need to finish.",
      deadline: 'We would like to have it as soon as we can today.',
    },
    high: {
      summary: 'Everyone in accounts needs it today, and none of us can find it.',
      detail:
        'All six of us in accounts need this today and none of us can find it. Other work is waiting until we have it.',
      deadline: 'We need it as soon as possible.',
    },
  },
  stageFrames: {
    'follow-up': {
      opening:
        'I called yesterday about the Export button, and I still have not been able to find it.',
      brief:
        'Carmen called yesterday about the same problem and was sent written steps. She has called back because she is still stuck.',
    },
    escalated: {
      opening:
        "This is my second call about finding the Export button. I was given steps, and they didn't work for me.",
      brief:
        'Carmen has contacted support twice about this problem. The steps she was sent did not solve it.',
    },
    closure: {
      opening: "I'm calling to check that the Export problem is sorted, so we can close this off.",
      brief: 'Carmen expects to confirm that she can export and close the case.',
    },
  },
  priorHistory: [
    {
      when: 'Yesterday afternoon',
      summary:
        'Carmen called about the missing Export button and was emailed a list of steps. No follow-up was arranged.',
    },
  ],

  knownFacts: [
    {
      id: 'kf-invoice-list',
      text: "I'm on the invoices page. I can see the list, but I can't find an Export button.",
      intents: ['problem_description'],
      elaboration:
        "I use this list every day, but I haven't had to take anything out of it before.",
      simple: 'I am on the invoices page. I can see the list. I cannot find the Export button.',
    },
    {
      id: 'kf-looked-around',
      text: "I've looked at the top of the page and down the left side. Nothing there says Export.",
      intents: ['already_tried'],
      simple: 'I looked at the top of the page and on the left side. I do not see Export.',
    },
    {
      id: 'kf-no-message',
      text: "There's no error message. The button just isn't there.",
      intents: ['error_message'],
      simple: 'There is no error message. The button is not there.',
    },
    {
      id: 'kf-laptop',
      text: "I'm using my work laptop and the usual browser.",
      intents: ['environment'],
      simple: 'I use my work laptop and the browser.',
    },
  ],

  hiddenFacts: [
    {
      id: 'hf-three-dots',
      importance: 'critical',
      label: 'Three-dots icon she has not opened',
      statement:
        "Across the top of the list I can see a search box, a filter icon and a small icon with three dots. I haven't clicked on the three dots.",
      revealWhen:
        'Asks what the customer can actually see on the screen, for example which buttons, icons or menus are across the top of the invoice list.',
      intents: ['problem_description', 'error_message', 'reproducibility'],
      cues: [
        'what do you see',
        'what can you see',
        'what are you seeing',
        'what you see',
        'across the top',
        'top of the',
        'top right',
        'toolbar',
        'icons',
        'buttons',
        'menu',
        'walk me through',
      ],
      hint: "There's a small icon at the top right, but I don't know what it does.",
      statementTerse:
        'A search box, a filter icon and three dots at the top. I have not clicked the dots.',
      statementSimple:
        'At the top I see a search box, a filter icon and a small icon with three dots. I did not click the dots.',
      missedConsequence:
        'Without checking her screen, the engineer reads out steps that mention a menu she cannot see, and the call stalls while she searches for it.',
      betterQuestion:
        'Can you tell me what you can see across the top of the invoice list, from left to right?',
    },
    {
      id: 'hf-narrow-window',
      importance: 'important',
      label: 'Browser window fills half the screen',
      statement:
        'The browser is only on half of my screen. I keep another program open on the other half.',
      revealWhen:
        "Asks about the customer's screen or window setup, such as the size of the browser window or whether it is full-screen.",
      intents: ['environment'],
      cues: [
        'window',
        'full screen',
        'full-screen',
        'maximi',
        'screen size',
        'resize',
        'how big',
        'how wide',
        'zoom',
        'small screen',
        'screen setup',
        'side by side',
      ],
      hint: 'I have two things open side by side on my screen.',
      statementTerse: 'Half the screen. I have another program open next to it.',
      statementSimple:
        'The browser takes half of my screen. I have another program open on the other half.',
      missedConsequence:
        'The engineer never learns why the menu is hidden, and the same problem returns the next time her window is narrow.',
      betterQuestion:
        'How big is your browser window right now: is it full-screen, or sharing the screen with something else?',
    },
    {
      id: 'hf-purpose-deadline',
      importance: 'important',
      label: "Last month's invoices for a 2 pm meeting",
      statement:
        "I need last month's invoices in a spreadsheet for a meeting at 2 pm. I only need last month, not the older ones.",
      revealWhen:
        'Asks what the customer is trying to achieve, what the invoices are for, which invoices are needed, or when she needs them by.',
      intents: ['expected_outcome', 'urgency_deadline', 'business_impact'],
      hint: "It's for a meeting this afternoon.",
      statementTerse: "Last month's invoices, in a spreadsheet, for a meeting at 2 pm.",
      statementSimple:
        "I need last month's invoices in a spreadsheet. I have a meeting at 2 pm. I do not need older invoices.",
      missedConsequence:
        'Without the purpose, the engineer cannot suggest setting the list to last month first, so she may export every invoice and lose time before her meeting.',
      betterQuestion:
        'What are you hoping to do with the export, and is there a time you need it by?',
    },
    {
      id: 'hf-old-guide',
      importance: 'helpful',
      label: 'Following an old training guide',
      statement:
        "I'm following the training PDF I was given when I started. It says to click an Export button at the top right of the list.",
      revealWhen:
        'Asks where the customer saw the Export button before, how she knows it exists, or whether she is following a guide or written steps.',
      intents: ['already_tried', 'timing_onset', 'recent_changes'],
      cues: [
        'guide',
        'pdf',
        'training',
        'instructions',
        'manual',
        'document',
        'how do you know',
        'remember',
        'before',
        'last time',
        'expect',
        'steps',
      ],
      hint: "I'm following the instructions I was given when I started.",
      statementTerse: 'A training PDF from when I started. It says click Export, top right.',
      statementSimple:
        'I follow the training PDF from when I started. It says to click the Export button at the top right.',
      missedConsequence:
        'The engineer does not learn that her guide describes an older layout, so the confusion returns and nobody updates the guide.',
      betterQuestion:
        'Where did you see the Export button before, and are you following a guide or written steps?',
    },
    {
      id: 'hf-manual-copy',
      importance: 'helpful',
      minDifficulty: 'standard',
      label: 'Already started copying rows by hand',
      statement:
        'I started copying the rows into a spreadsheet by hand, but there are a lot of them and the columns end up in the wrong places.',
      revealWhen:
        'Asks whether the customer has tried another way to get the invoices out, or what she has done in the meantime.',
      intents: ['workaround', 'already_tried'],
      cues: [
        'workaround',
        'another way',
        'other way',
        'anything else',
        'in the meantime',
        'copy',
        'paste',
        'by hand',
        'manually',
        'instead',
      ],
      statementTerse: 'I started copying rows by hand. The columns end up in the wrong places.',
      statementSimple:
        'I started to copy the rows by hand. There are many rows and the columns go in the wrong places.',
      missedConsequence:
        'The engineer misses how much time she has already spent, and may suggest a manual workaround that wastes more.',
      betterQuestion: 'Have you tried any other way of getting the invoices out in the meantime?',
    },
  ],

  incorrectAssumptions: [
    {
      id: 'ia-button-removed',
      statement: 'I think the Export button has been taken away, or my account no longer has it.',
      truth:
        'Export was not removed and her access has not changed. It moved into the Share menu, which is hidden behind a three-dot icon on her narrow window.',
    },
    {
      id: 'ia-wrong-page',
      statement: "Maybe I'm on the wrong page for exporting.",
      truth:
        'She is on the right page. The feature has moved within it, so the place she expects is empty.',
    },
  ],

  curveballs: [
    {
      id: 'cb-meeting-getting-close',
      type: 'deadline',
      trigger: { earliestTurn: 4, latestTurn: 8, afterFact: 'hf-purpose-deadline' },
      statement:
        "I'm sorry to hurry you, but I don't have much time before my meeting. How many more steps are there?",
      followUp:
        'Roughly how long will this take? I want to know whether to start on something else.',
      expectedResponse:
        'Acknowledge the time pressure without rushing her. Say how many steps remain, then guide her one step at a time with a quick check of her screen after each. Save extra explanation until the file has opened.',
      minDifficulty: 'starter',
      effects: { temperature: 4, patience: -5 },
    },
    {
      id: 'cb-steps-did-not-match',
      type: 'previous-bad-experience',
      trigger: { earliestTurn: 5, latestTurn: 9 },
      statement:
        "The last time I asked for help with something like this, I was sent a long list of steps and they didn't match what I could see.",
      followUp: "I'd just like to be sure these will match my screen.",
      expectedResponse:
        'Acknowledge the earlier experience without defending it. Show the difference by asking what she sees before each instruction, and confirm each step on her screen.',
      minDifficulty: 'standard',
      effects: { temperature: 4, trust: -5 },
    },
  ],

  expectedDiscoveryAreas: [
    'What she wants to achieve and by when',
    'What is on her screen',
    'Her window and device',
    'What she has already tried',
  ],
  successCriteria: [
    'Greets Carmen, introduces themselves and asks what she is trying to do.',
    'Finds out what she needs and when before giving any steps.',
    'Checks what she can actually see on her screen before reading out instructions.',
    'Guides her one step at a time and confirms each step on her screen.',
    'Confirms that the file opened correctly and mentions that her guide describes an older layout.',
  ],
  coachingFocus: ['scoping-discovery', 'clarity'],
  poorApproaches: [
    'Reading out a long list of steps without checking what Carmen can see on her screen.',
    'Telling her where the button should be instead of asking what is actually on the page.',
    'Sending her a link or a document instead of guiding her through it.',
    'Using terms such as "overflow menu" or "responsive layout" without explaining them.',
  ],
  goodBehaviours: [
    'Asking what she is trying to do with the export and when she needs it.',
    'Asking her to describe the top of the page in her own words.',
    'Asking how big her browser window is, or what else is on her screen.',
    'Giving one instruction at a time and checking the result on her screen before the next.',
    'Suggesting she set the list to last month before exporting, and saying that her guide is out of date.',
  ],
  expectedOutcome:
    'Carmen opens the collapsed menu, finds Export under Share, sets the list to last month and exports it before her meeting. She understands that her guide describes an older layout, and the engineer confirms that the file opened correctly.',
  evaluatorNotes:
    "Root cause: since a layout update, Export is in the Share menu, not a button on the list. Carmen's browser window fills half her screen, so the toolbar collapses and Share sits behind a three-dot icon she has not opened. She is also following a training PDF for the old layout. A strong call asks what she is trying to achieve (last month's invoices for a 2 pm meeting), checks what she can see and how big her window is, then guides her one step at a time, suggests setting the list to last month first and confirms the file opened. The main failure is reading out steps without checking her screen.",
} satisfies ScenarioInput;

export default scenario;
