import { describe, expect, it } from 'vitest';
import { conformCustomerReply, endListItems, sentenceCount } from './conform.ts';

const conform = (text: string, maxSentences = 3, maxChars?: number) =>
  conformCustomerReply(
    text,
    maxChars === undefined ? { maxSentences } : { maxSentences, maxChars },
  );

describe('conforming a customer reply', () => {
  it('leaves a short, plain reply exactly as it is', () => {
    const result = conform("I can't sign in. It started this morning.");
    expect(result).toEqual({
      text: "I can't sign in. It started this morning.",
      changed: false,
      problems: [],
    });
  });

  it('cuts a long reply at a sentence boundary, never in the middle of one', () => {
    const result = conform(
      'One thing happened. A second thing happened. A third thing happened. And a fourth.',
      2,
    );
    expect(result.text).toBe('One thing happened. A second thing happened.');
    expect(result.problems).toContain('too-long');
    expect(sentenceCount(result.text)).toBe(2);
  });

  it('keeps at least the first sentence, and uses the character limit as a second limit', () => {
    expect(conform('A very long first sentence that goes on and on.', 0).text).toBe(
      'A very long first sentence that goes on and on.',
    );
    const limited = conform('First short one. Second short one. Third short one.', 5, 30);
    expect(limited.text).toBe('First short one.');
    expect(limited.problems).toContain('too-long');
  });

  it('flattens lists, headings and line breaks into plain speech', () => {
    const result = conform(
      'Here is what I did:\n- Restarted the laptop\n- Tried the phone\n\n## Notes\n1. Nothing worked',
      6,
    );
    expect(result.text).not.toMatch(/\n/);
    expect(result.text).not.toMatch(/(?:^|\s)(?:-|#|\d\.)\s/);
    expect(result.text).toContain('Restarted the laptop.');
    expect(result.problems).toContain('list-or-heading');
  });

  it('removes praise for the engineer, and turns "that is correct" into what a customer says', () => {
    const praised = conform('Great question! My phone has been acting up. You did a great job.');
    expect(praised.text).toBe('My phone has been acting up.');
    expect(praised.problems).toContain('praise');
    expect(conform("That's correct. I did change it this morning.").text).toBe(
      "That's right. I did change it this morning.",
    );
    expect(conform('Well done, spot on.').problems).toEqual(
      expect.arrayContaining(['praise', 'empty']),
    );
  });

  it('ends the lines of a list as sentences before line breaks are collapsed, and leaves other breaks alone', () => {
    expect(
      endListItems(
        'Here is what I have:\n- The laptop is a Dell\n* It started Monday!\n\u2022 I tried: a restart:\n1. Nothing helped\n2) It still fails.\n## Notes',
      ),
    ).toBe(
      'Here is what I have:\nThe laptop is a Dell.\nIt started Monday!\nI tried: a restart.\nNothing helped.\nIt still fails.\nNotes.',
    );
    // A sentence wrapped over two lines is one sentence, and a bare marker leaves nothing behind.
    expect(endListItems('It is slow\ntoday and I cannot sign in.\r\n- \nThanks')).toBe(
      'It is slow\ntoday and I cannot sign in.\n\nThanks',
    );
    // Plain speech, with no line breaks, is exactly as it was.
    expect(endListItems("I can't sign in. It started this morning.")).toBe(
      "I can't sign in. It started this morning.",
    );
  });

  it('does not take what the customer says about their own plans, offers and answers for coaching', () => {
    for (const text of [
      "I'll try asking our administrator.",
      'Let me try to ask Dana in IT.',
      'I could try asking the team, I suppose.',
      'Do you want me to try asking our administrator?',
      "Next time I'll try the web version first.",
      "Next time I'll ask Jen to send it.",
      "Don't ask me about the policy. I only use the mailbox.",
      'Don\u2019t ask me about the policy. I only use the mailbox.',
      'If you ask me about the policy, I would not know.',
    ]) {
      const result = conform(text);
      expect(result.problems, text).toEqual([]);
      expect(result.text, text).toBe(text);
    }
    // Alone it is a whole reply, not an empty one.
    expect(conform("I'll try asking our administrator.").problems).not.toContain('empty');
  });

  it('still removes telling the engineer what to ask, in every form', () => {
    for (const text of [
      'Try asking me about the screen.',
      'You could try asking me about my phone.',
      'You can try asking me what it says.',
      'You might try asking me about the phone.',
      'Next time, ask about my phone.',
      'Next time you should ask about the phone.',
      'Please ask me about the laptop.',
      'You should have asked about my phone first.',
    ]) {
      const result = conform(`It keeps asking for a password. ${text}`);
      expect(result.problems, text).toContain('coaching');
      expect(result.text, text).toBe('It keeps asking for a password.');
    }
  });

  it('never coaches the engineer or announces what it is holding back', () => {
    const coached = conform(
      'It keeps asking for a password. You should have asked about my phone first. Ask me about the screen.',
    );
    expect(coached.text).toBe('It keeps asking for a password.');
    expect(coached.problems).toContain('coaching');
    const announced = conform(
      'Here is another hidden fact for you. I changed my password at eight.',
    );
    expect(announced.text).toBe('I changed my password at eight.');
    expect(announced.problems).toContain('announces-facts');
  });

  it('is empty, and says so, when nothing of the reply can be kept', () => {
    for (const text of ['', '   ', '- ', 'You should ask me about the phone.']) {
      const result = conform(text);
      expect(result.text, text).toBe('');
      expect(result.problems, text).toContain('empty');
    }
  });

  it('never makes a reply longer than the limit it was given, whatever the model sent', () => {
    for (let n = 1; n <= 8; n++) {
      const text = Array.from(
        { length: n + 3 },
        (_, i) => `Sentence number ${i + 1} is here.`,
      ).join(' ');
      expect(sentenceCount(conform(text, n).text)).toBeLessThanOrEqual(n);
    }
  });
});

describe('what an assistant says and a customer does not', () => {
  const NOTE = 'It keeps asking for a password.';

  it('removes cheerful assent, pledges of understanding, thanks for patience and offers of help', () => {
    for (const text of [
      'Certainly!',
      'Certainly, I can check that.',
      'Absolutely!',
      'I understand your concern.',
      'I completely understand your frustration.',
      'Thank you for your patience.',
      'Thanks for your understanding.',
      'Thank you for reaching out.',
      "I'm happy to help with that.",
      "I'd be glad to answer that.",
      'How can I help you today?',
      'Is there anything else I can help with?',
      'Please let me know if you need anything else.',
      'I apologise for any inconvenience.',
    ]) {
      const result = conform(`${NOTE} ${text}`);
      expect(result.problems, text).toContain('ai-politeness');
      expect(result.text, text).toBe(NOTE);
    }
  });

  it('treats a bare "Understood." as the robotic agreement it is, and nothing longer than that', () => {
    expect(conform('Understood.')).toMatchObject({
      text: '',
      problems: ['ai-politeness', 'empty'],
    });
    expect(conform('Noted!').text).toBe('');
    // A customer who does understand, and says what, is just talking.
    for (const text of [
      'I understand it takes time. I just need it working by Friday.',
      "I'm sorry, I didn't understand. Could you say that again?",
      'Thanks for waiting.',
      'Thank you.',
      'Yes, please do.',
    ]) {
      expect(conform(text).problems, text).toEqual([]);
    }
  });

  it('removes praise of a troubleshooting step, which is not what a customer says', () => {
    for (const text of [
      'Good troubleshooting step.',
      "That's a great diagnostic question.",
      'Good thinking.',
      'Excellent follow-up question!',
    ]) {
      const result = conform(`${text} ${NOTE}`);
      expect(result.problems, text).toContain('praise');
      expect(result.text, text).toBe(NOTE);
    }
  });
});

describe('the engineer\u2019s name', () => {
  const named = (text: string, recent: string[] = [], name = 'Alex') =>
    conformCustomerReply(text, { maxSentences: 4, engineerName: { name, recent } });

  it('is said once in any five replies: kept the first time, left out of the next four', () => {
    expect(named('Thanks, Alex. It started on Monday.')).toEqual({
      text: 'Thanks, Alex. It started on Monday.',
      changed: false,
      problems: [],
    });
    const earlier = ['Thanks, Alex. It started on Monday.', 'Okay.', 'Yes.', 'It is a Dell.'];
    const result = named('Thanks, Alex. It is still down.', earlier);
    expect(result.text).toBe('Thanks. It is still down.');
    expect(result.problems).toEqual(['repeats-name']);
    // Five replies on, it may be said again.
    expect(named('Thanks, Alex.', [...earlier, 'Fine.']).problems).toEqual([]);
  });

  it('is said at most once within a reply', () => {
    const result = named('Hi Alex, thanks. Alex, it is still down.');
    expect(result.text).toBe('Hi Alex, thanks. It is still down.');
    expect(result.problems).toEqual(['repeats-name']);
  });

  it('only counts as said when it is said to the engineer, not when it is a word like any other', () => {
    for (const text of ['Will you call me back?', 'Will it be fixed today?']) {
      expect(named(text, ['Thanks, Will.'], 'Will')).toMatchObject({ text, problems: [] });
    }
    expect(named('Thanks, Will. It is still down.', ['Thanks, Will.'], 'Will').text).toBe(
      'Thanks. It is still down.',
    );
    // A customer with the same first name is not addressing anyone.
    expect(named('My manager Alex is in on Monday.', ['Thanks, Alex.']).problems).toEqual([]);
  });

  it('is left alone when the conformer has not been told the name', () => {
    expect(conform('Thanks, Alex. Thanks, Alex.').problems).toEqual([]);
  });
});
