import { describe, expect, it } from 'vitest';
import { SPEECH_LANGUAGES, type SpeechLanguage } from '#shared/domain/speech.ts';
import { VOICE_CHOICES, VOICE_IDS, type VoiceId } from '#shared/domain/voices.ts';
import { TEMPERATURE_BANDS, type TemperatureBandId } from '#shared/domain/vocab.ts';
import {
  chooseVoice,
  cleanText,
  DEFAULT_VOICES,
  describeVoices,
  escapeXml,
  listsMoodStyles,
  MAX_PITCH_PERCENT,
  MAX_RATE_PERCENT,
  MAX_SPOKEN_CHARS,
  MIN_RATE_PERCENT,
  moodStylesAvailable,
  planSpeech,
  prepareSpokenText,
  prosodyFor,
  styleFor,
  voiceDirection,
  voiceOptions,
  VOICE_CATALOGUE,
  VOICE_STYLES,
  type Speaker,
} from './voices.ts';

const MOODS = TEMPERATURE_BANDS.map((b) => b.id);
const SPEAKERS: Speaker[] = ['female', 'male'];
const direction = (
  mood: TemperatureBandId,
  speaker: Speaker = 'female',
  language: SpeechLanguage = 'en-GB',
) => voiceDirection({ speaker, language, mood });

/** A small check that an SSML document is well formed: tags nest, attributes are quoted, text holds no stray markup. */
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  const token = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:.-]+="[^"<&]*")*)\s*(\/?)>|([^<]+)/gy;
  let at = 0;
  for (let m = token.exec(xml); m; m = token.exec(xml)) {
    at = token.lastIndex;
    const [, closing, name, , selfClosing, text] = m;
    if (text !== undefined) {
      if (text.includes('>') || /&(?!(?:amp|lt|gt|quot|apos);)/.test(text)) return false;
    } else if (closing) {
      if (stack.pop() !== name) return false;
    } else if (!selfClosing) {
      stack.push(name as string);
    }
  }
  return at === xml.length && stack.length === 0;
}

describe('the checker used below', () => {
  it('accepts well-formed documents and refuses broken ones', () => {
    expect(wellFormed('<a x="1"><b>t &amp; u</b></a>')).toBe(true);
    expect(wellFormed('<a><b></a></b>')).toBe(false);
    expect(wellFormed('<a>fish & chips</a>')).toBe(false);
    expect(wellFormed('<a x=1></a>')).toBe(false);
    expect(wellFormed('<a>text')).toBe(false);
  });
});

describe('the built-in voices', () => {
  it('are a female and a male standard neural voice for every language, spoken in that language', () => {
    expect(DEFAULT_VOICES).toEqual({
      'en-GB': { female: 'en-GB-SoniaNeural', male: 'en-GB-RyanNeural' },
      'en-US': { female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' },
      'en-IE': { female: 'en-IE-EmilyNeural', male: 'en-IE-ConnorNeural' },
      'en-AU': { female: 'en-AU-NatashaNeural', male: 'en-AU-WilliamNeural' },
      'en-IN': { female: 'en-IN-NeerjaNeural', male: 'en-IN-PrabhatNeural' },
    });
    for (const language of SPEECH_LANGUAGES) {
      for (const speaker of SPEAKERS) {
        const voice = DEFAULT_VOICES[language][speaker];
        expect(voice.startsWith(`${language}-`), voice).toBe(true);
        expect(voice.endsWith('Neural'), voice).toBe(true);
        // Every default has an entry in the verified table, even if it lists no styles.
        expect(VOICE_STYLES[voice], voice).toBeDefined();
      }
    }
  });

  it('can be replaced for a speaker, in every language', () => {
    expect(chooseVoice({ speaker: 'female', language: 'en-IE' })).toBe('en-IE-EmilyNeural');
    const overrides = { female: 'en-US-JennyNeural', male: null };
    expect(chooseVoice({ speaker: 'female', language: 'en-IE' }, overrides)).toBe(
      'en-US-JennyNeural',
    );
    expect(chooseVoice({ speaker: 'male', language: 'en-IE' }, overrides)).toBe(
      'en-IE-ConnorNeural',
    );
  });
});

describe('which voices have which styles', () => {
  it('gives Sonia and Ryan no angry or unfriendly style, because their documentation lists none', () => {
    expect(VOICE_STYLES['en-GB-SoniaNeural']).toEqual(['cheerful', 'sad']);
    expect(VOICE_STYLES['en-GB-RyanNeural']).toEqual(['chat', 'cheerful', 'sad', 'whispering']);
    for (const voice of ['en-GB-SoniaNeural', 'en-GB-RyanNeural']) {
      for (const mood of MOODS) {
        expect(styleFor(voice, direction(mood)), `${voice} ${mood}`).toBeNull();
      }
    }
  });

  it('lists no styles for the Irish, Australian and Indian male voices or the Irish and Australian female voices', () => {
    for (const voice of [
      'en-IE-EmilyNeural',
      'en-IE-ConnorNeural',
      'en-AU-NatashaNeural',
      'en-AU-WilliamNeural',
      'en-IN-PrabhatNeural',
    ]) {
      expect(VOICE_STYLES[voice], voice).toEqual([]);
    }
    // Neerja has three styles, none of them a frustrated or angry one.
    expect(VOICE_STYLES['en-IN-NeerjaNeural']).toEqual(['cheerful', 'empathetic', 'newscast']);
  });

  it('applies unfriendly for a frustrated customer and angry for an angry or escalating one, only on voices that list them', () => {
    for (const voice of ['en-US-AriaNeural', 'en-US-GuyNeural']) {
      expect(styleFor(voice, direction('frustrated'))?.style, voice).toBe('unfriendly');
      expect(styleFor(voice, direction('angry'))?.style, voice).toBe('angry');
      expect(styleFor(voice, direction('escalating'))?.style, voice).toBe('angry');
      expect(styleFor(voice, direction('calm')), voice).toBeNull();
      expect(styleFor(voice, direction('concerned')), voice).toBeNull();
    }
  });

  it('applies no style to a voice that is not in the verified table', () => {
    for (const mood of MOODS) {
      expect(styleFor('en-US-SomeNewVoiceNeural', direction(mood))).toBeNull();
      expect(styleFor('', direction(mood))).toBeNull();
    }
  });

  it('never asks for shouting, and never above a controlled degree', () => {
    for (const [voice, styles] of Object.entries(VOICE_STYLES)) {
      for (const mood of MOODS) {
        for (let intensity = 0; intensity <= 1.0001; intensity += 0.05) {
          const chosen = styleFor(voice, { mood, intensity });
          if (!chosen) continue;
          expect(styles, voice).toContain(chosen.style);
          expect(['unfriendly', 'angry']).toContain(chosen.style);
          expect(chosen.degree, `${voice} ${mood} ${intensity}`).toBeGreaterThanOrEqual(0.2);
          expect(chosen.degree, `${voice} ${mood} ${intensity}`).toBeLessThanOrEqual(0.9);
        }
      }
    }
  });

  it('grows the style degree with the mood', () => {
    const degrees = (['frustrated', 'angry', 'escalating'] as const).map(
      (mood) => styleFor('en-US-AriaNeural', direction(mood))?.degree,
    );
    expect(degrees).toEqual([0.55, 0.73, 0.9]);
  });
});

describe('mood to delivery', () => {
  it('speaks a calm customer at a measured pace and a hotter one more firmly', () => {
    expect(MOODS.map((mood) => [mood, direction(mood).pace, direction(mood).intensity])).toEqual([
      ['calm', 'measured', 0],
      ['concerned', 'brisk', 0.25],
      ['frustrated', 'firm', 0.5],
      ['angry', 'firm', 0.75],
      ['escalating', 'firm', 1],
    ]);
  });

  it('changes rate and pitch by small, increasing amounts when no style is applied', () => {
    expect(MOODS.map((mood) => prosodyFor(direction(mood), false))).toEqual([
      { rate: '-4%', pitch: null },
      { rate: '+6%', pitch: '+3%' },
      { rate: '+8%', pitch: '-2%' },
      { rate: '+11%', pitch: '-3%' },
      { rate: '+14%', pitch: '-4%' },
    ]);
  });

  it('leaves the pitch alone when a style carries the tone', () => {
    for (const mood of MOODS) expect(prosodyFor(direction(mood), true).pitch).toBeNull();
    expect(prosodyFor(direction('angry'), true).rate).toBe('+11%');
  });

  it('stays well inside the documented limits (rate 0.5 to 2 times, pitch 0.5 to 1.5 times)', () => {
    for (const mood of MOODS) {
      const { rate, pitch } = prosodyFor(direction(mood), false);
      expect(Math.abs(Number.parseInt(rate, 10))).toBeLessThanOrEqual(20);
      expect(Math.abs(Number.parseInt(pitch ?? '0', 10))).toBeLessThanOrEqual(10);
    }
  });

  it('copes with an intensity outside 0 to 1 or not a number', () => {
    expect(prosodyFor({ pace: 'firm', intensity: 5 }, false)).toEqual(
      prosodyFor({ pace: 'firm', intensity: 1 }, false),
    );
    expect(prosodyFor({ pace: 'firm', intensity: Number.NaN }, false).rate).toBe('+2%');
    expect(styleFor('en-US-AriaNeural', { mood: 'angry', intensity: -3 })?.degree).toBe(0.2);
  });
});

describe('whether moods can be voiced with styles', () => {
  it('is false with the built-in voices, because only the en-US voices list the styles', () => {
    expect(moodStylesAvailable()).toBe(false);
  });

  it('is true only when every language resolves to voices that list them', () => {
    expect(moodStylesAvailable({ female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' })).toBe(true);
    expect(moodStylesAvailable({ female: 'en-US-AriaNeural' })).toBe(false);
    expect(moodStylesAvailable({ female: 'en-US-AriaNeural', male: 'en-GB-RyanNeural' })).toBe(
      false,
    );
    expect(moodStylesAvailable({ female: 'en-US-NotListedNeural', male: 'en-US-GuyNeural' })).toBe(
      false,
    );
  });
});

describe('preparing the words to be spoken', () => {
  it('removes control characters and invisible formatting and tidies whitespace', () => {
    expect(cleanText('Hello\u0000 there\u0007,\n\tI\u200b am\u202e  here\u2028now \ufeffok')).toBe(
      'Hello there, I am here now ok',
    );
    expect(cleanText('a\u000bb\u000cc')).toBe('a b c');
    expect(cleanText('\u0085nel\u009f')).toBe('nel');
  });

  it('removes surrogates that are not part of a pair and keeps real emoji', () => {
    expect(cleanText('lone \ud800 high and \udc00 low')).toBe('lone high and low');
    expect(cleanText('fine \u{1f642} stays')).toBe('fine \u{1f642} stays');
  });

  it('leaves a short line as it is', () => {
    expect(prepareSpokenText('Hello. I need help.')).toEqual({
      text: 'Hello. I need help.',
      truncated: false,
    });
  });

  it('cuts a long line at the last whole sentence that fits', () => {
    const sentence = (n: number) =>
      `This is sentence number ${n} of the customer's long complaint.`;
    const long = Array.from({ length: 40 }, (_, i) => sentence(i + 1)).join(' ');
    expect(long.length).toBeGreaterThan(MAX_SPOKEN_CHARS);
    const result = prepareSpokenText(long);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(result.text.endsWith('complaint.')).toBe(true);
    expect(long.startsWith(result.text)).toBe(true);
    // Not a sentence short: the next one would not have fitted.
    const kept = result.text.split('. ').length;
    expect(`${result.text} ${sentence(kept + 1)}`.length).toBeGreaterThan(MAX_SPOKEN_CHARS);
  });

  it('cuts one very long sentence at a word instead', () => {
    const run = 'word '.repeat(400).trim();
    const result = prepareSpokenText(run, 100);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(100);
    expect(result.text.endsWith('word')).toBe(true);
  });

  it('cuts text that has no spaces at the limit', () => {
    expect(prepareSpokenText('x'.repeat(500), 100).text).toBe('x'.repeat(100));
  });
});

describe('escaping', () => {
  it('escapes every character that XML treats specially', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;',
    );
    expect(escapeXml('plain words')).toBe('plain words');
  });
});

describe('planSpeech: the SSML request', () => {
  const line = "I've been waiting for two days & nobody has called me back.";

  it('uses prosody alone for a frustrated customer on a voice with no styles, with the text escaped', () => {
    const plan = planSpeech(line, direction('frustrated'));
    expect(plan.voice).toBe('en-GB-SoniaNeural');
    expect(plan.voiceId).toBeNull();
    expect(plan.style).toBe('none');
    expect(plan.ssml).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-GB">' +
        '<voice name="en-GB-SoniaNeural"><prosody rate="+8%" pitch="-2%">' +
        'I&apos;ve been waiting for two days &amp; nobody has called me back.' +
        '</prosody></voice></speak>',
    );
    expect(wellFormed(plan.ssml)).toBe(true);
  });

  it('adds the style, at a reduced degree and without a pitch change, when the voice lists it', () => {
    const plan = planSpeech(line, direction('angry', 'male', 'en-US'));
    expect(plan.voice).toBe('en-US-GuyNeural');
    expect(plan.style).toBe('angry');
    expect(plan.ssml).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">' +
        '<voice name="en-US-GuyNeural"><mstts:express-as style="angry" styledegree="0.73">' +
        '<prosody rate="+11%">I&apos;ve been waiting for two days &amp; nobody has called me back.</prosody>' +
        '</mstts:express-as></voice></speak>',
    );
    expect(wellFormed(plan.ssml)).toBe(true);
  });

  it('escapes the characters XML treats specially, when they are plainly part of what is said', () => {
    const plan = planSpeech('It took 5 < 6 days, and "they" said 7 > 3.', direction('calm'));
    expect(plan.ssml).toContain('It took 5 &lt; 6 days, and &quot;they&quot; said 7 &gt; 3.');
    expect(wellFormed(plan.ssml)).toBe(true);
  });

  it('uses unfriendly for frustrated on the US female voice', () => {
    const plan = planSpeech('Hello.', direction('frustrated', 'female', 'en-US'));
    expect(plan.voice).toBe('en-US-AriaNeural');
    expect(plan.style).toBe('unfriendly');
    expect(plan.ssml).toContain('<mstts:express-as style="unfriendly" styledegree="0.55">');
  });

  it('plays a calm customer plainly, with no style for any voice', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const speaker of SPEAKERS) {
        const plan = planSpeech('Hello.', direction('calm', speaker, language));
        expect(plan.style).toBe('none');
        expect(plan.ssml).not.toContain('express-as');
        expect(plan.ssml).toContain('<prosody rate="-4%">Hello.</prosody>');
      }
    }
  });

  it('never contains express-as or shouting unless the voice lists the style, for any voice, mood and language', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const speaker of SPEAKERS) {
        for (const mood of MOODS) {
          const plan = planSpeech('Hello there.', direction(mood, speaker, language));
          expect(wellFormed(plan.ssml), `${language} ${speaker} ${mood}`).toBe(true);
          expect(plan.ssml).not.toContain('shouting');
          const styled = plan.ssml.includes('express-as');
          expect(styled, `${language} ${speaker} ${mood}`).toBe(plan.style !== 'none');
          if (styled) expect(VOICE_STYLES[plan.voice]).toContain(plan.style);
          if (styled) expect(language).toBe('en-US');
        }
      }
    }
  });

  it('declares the language of the voice it uses, even for a replacement voice', () => {
    expect(planSpeech('Hi.', direction('calm', 'male', 'en-AU')).ssml).toContain(
      'xml:lang="en-AU"',
    );
    const swapped = planSpeech('Hi.', direction('calm', 'female', 'en-GB'), {
      female: 'en-US-JennyNeural',
    });
    expect(swapped.voice).toBe('en-US-JennyNeural');
    expect(swapped.ssml).toContain('xml:lang="en-US"');
    expect(swapped.ssml).toContain('<voice name="en-US-JennyNeural">');
  });

  it('applies a style to a replacement voice only if the table lists it for that voice', () => {
    expect(planSpeech('Hi.', direction('angry'), { female: 'en-US-JennyNeural' }).style).toBe(
      'angry',
    );
    expect(planSpeech('Hi.', direction('angry'), { female: 'fr-FR-SomeoneNeural' }).style).toBe(
      'none',
    );
  });

  it('cannot be made to carry markup from the text', () => {
    const hostile =
      '</prosody></voice></speak><speak><voice name="evil"><audio src="http://x/y.wav"/>Hello there.';
    const plan = planSpeech(hostile, direction('angry', 'female', 'en-US'));
    expect(wellFormed(plan.ssml)).toBe(true);
    expect(plan.ssml.match(/<voice /g)).toHaveLength(1);
    expect(plan.ssml.match(/<speak /g)).toHaveLength(1);
    // The markup-like words never reach the voice at all, and what is left is only what was said.
    expect(plan.text).toBe('Hello there.');
    expect(plan.ssml).not.toContain('<audio');
    expect(plan.ssml).not.toContain('evil');
    expect(plan.ssml).not.toContain('y.wav');
    // Anything that does look like text is escaped, so it can never be read as markup.
    const escaped = planSpeech('Typed </prosody and "x"> oddly', direction('calm'));
    expect(wellFormed(escaped.ssml)).toBe(true);
    expect(escaped.ssml.match(/<prosody /g)).toHaveLength(1);
  });

  it('strips control characters before building the document', () => {
    const plan = planSpeech('Hello\u0000\u0008 there\u001f.', direction('calm'));
    expect(plan.text).toBe('Hello there.');
    // eslint-disable-next-line no-control-regex
    expect(plan.ssml).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  });

  it('speaks a long line cut at a sentence and says so, leaving the stored text to the caller', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i + 1} is here.`).join(
      ' ',
    );
    const plan = planSpeech(long, direction('calm'));
    expect(plan.truncated).toBe(true);
    expect(plan.text.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(plan.text.endsWith('here.')).toBe(true);
    expect(planSpeech('Short.', direction('calm')).truncated).toBe(false);
  });

  it('keeps the request small whatever the text, even when every character needs escaping', () => {
    for (const worst of ['"', '&', '<', "'"]) {
      const plan = planSpeech(worst.repeat(5000), direction('angry', 'male', 'en-US'));
      expect(Buffer.byteLength(plan.ssml)).toBeLessThan(8192);
      expect(wellFormed(plan.ssml)).toBe(true);
    }
    // Wide characters take up to four bytes each in UTF-8.
    const wide = planSpeech('\u{1f642}'.repeat(5000), direction('calm'));
    expect(Buffer.byteLength(wide.ssml)).toBeLessThan(8192);
  });

  it('has nothing to speak for text that is only control characters', () => {
    expect(planSpeech('\u0000\u0001  \u200b', direction('calm')).text).toBe('');
  });
});

// ---------------------------------------------------------------------------------------
// The four neutral choices

/**
 * Who the documentation says each voice is (Microsoft's language support page, "Text to speech
 * voices"). It is here so a test can check that no choice is always the same kind of voice. Nothing
 * outside this test knows or uses it.
 */
const PRESENTATION: Record<string, 'f' | 'm'> = {
  'en-GB-SoniaNeural': 'f',
  'en-GB-RyanNeural': 'm',
  'en-GB-LibbyNeural': 'f',
  'en-GB-ThomasNeural': 'm',
  'en-US-GuyNeural': 'm',
  'en-US-AriaNeural': 'f',
  'en-US-DavisNeural': 'm',
  'en-US-JennyNeural': 'f',
  'en-AU-NatashaNeural': 'f',
  'en-AU-WilliamNeural': 'm',
  'en-AU-DarrenNeural': 'm',
  'en-AU-AnnetteNeural': 'f',
  'en-IN-AaravNeural': 'm',
  'en-IN-NeerjaNeural': 'f',
  'en-IN-AashiNeural': 'f',
  'en-IN-KunalNeural': 'm',
  'en-IE-ConnorNeural': 'm',
  'en-IE-EmilyNeural': 'f',
};

describe('the four neutral customer voices', () => {
  it('are Voice A to Voice D, named by how they are delivered and nothing else', () => {
    expect(VOICE_CHOICES.map((choice) => [choice.id, choice.label])).toEqual([
      ['voice-a', 'Voice A - Warm'],
      ['voice-b', 'Voice B - Direct'],
      ['voice-c', 'Voice C - Measured'],
      ['voice-d', 'Voice D - Concise'],
    ]);
    expect(VOICE_IDS).toEqual(['voice-a', 'voice-b', 'voice-c', 'voice-d']);
    // No person, gender, accent, age or other stereotype in anything a trainee can read.
    const stereotype =
      /\b(?:male|female|man|woman|men|women|boy|girl|guy|lady|young|old|elderly|senior|british|english|american|irish|australian|indian|scottish|welsh|accent|posh|deep|husky|sweet|motherly|fatherly|sassy|nerdy)\b/i;
    for (const choice of VOICE_CHOICES) {
      expect(`${choice.label} ${choice.trait} ${choice.description}`).not.toMatch(stereotype);
    }
  });

  it('map to a different synthetic voice each, in every language that has four, and say so where it has fewer', () => {
    for (const language of SPEECH_LANGUAGES) {
      const options = voiceOptions(language);
      expect(options.map((option) => option.id)).toEqual([...VOICE_IDS]);
      const distinct = new Set(options.map((option) => option.providerVoice)).size;
      // Ireland has two standard voices in the documentation: the other two choices share them.
      expect(distinct, language).toBe(language === 'en-IE' ? 2 : 4);
      expect(
        options.map((option) => option.shared),
        language,
      ).toEqual(language === 'en-IE' ? [false, false, true, true] : [false, false, false, false]);
    }
  });

  it('are standard neural voices of the language they speak, from the documented table, never a cloned, celebrity or HD voice', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const id of VOICE_IDS) {
        const voice = VOICE_CATALOGUE[language][id];
        expect(voice.startsWith(`${language}-`), voice).toBe(true);
        expect(voice, voice).toMatch(/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/);
        expect(voice).not.toMatch(/Multilingual|Dragon|MAI|Child|Maisie|Indic|:/);
        // Listed in the verified table, even if it lists no styles.
        expect(VOICE_STYLES[voice], voice).toBeDefined();
      }
    }
  });

  it('are arranged so that no choice is always the same kind of voice', () => {
    for (const id of VOICE_IDS) {
      const kinds = (['en-GB', 'en-US', 'en-AU', 'en-IN'] as const).map(
        (language) => PRESENTATION[VOICE_CATALOGUE[language][id]],
      );
      expect(
        kinds.filter((kind) => kind === 'f'),
        id,
      ).toHaveLength(2);
      expect(
        kinds.filter((kind) => kind === 'm'),
        id,
      ).toHaveLength(2);
    }
    // Each language with four voices has two of each.
    for (const language of ['en-GB', 'en-US', 'en-AU', 'en-IN'] as const) {
      const kinds = VOICE_IDS.map((id) => PRESENTATION[VOICE_CATALOGUE[language][id]]);
      expect(
        kinds.filter((kind) => kind === 'f'),
        language,
      ).toHaveLength(2);
    }
  });

  it('can speak every mood in a style only where the voice lists the styles moods ask for', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const option of voiceOptions(language)) {
        expect(option.styles, `${language} ${option.id}`).toBe(language === 'en-US');
        expect(option.styles).toBe(listsMoodStyles(option.providerVoice));
      }
    }
    // The default pairing still cannot: only the US voices list the styles.
    expect(moodStylesAvailable()).toBe(false);
  });

  it('are described for the web app without naming any provider voice', () => {
    const described = describeVoices(voiceOptions);
    expect(described.map((voice) => voice.id)).toEqual([...VOICE_IDS]);
    for (const voice of described) {
      expect(Object.keys(voice.languages).sort()).toEqual([...SPEECH_LANGUAGES].sort());
    }
    expect(described[0]?.languages['en-IE']).toEqual({ voice: 'own', styles: false });
    expect(described[2]?.languages['en-IE']).toEqual({ voice: 'shared', styles: false });
    expect(described[2]?.languages['en-US']).toEqual({ voice: 'own', styles: true });
    const text = JSON.stringify(described);
    expect(text).not.toMatch(/Neural|Sonia|Ryan|Aria|Guy|Jenny|Davis|Libby|Thomas|Emily|Connor/);
    expect(text).not.toMatch(/female|male|speaker/i);
  });
});

describe('choosing the voice', () => {
  it('uses the voice the trainee chose, in the language asked for, whatever the speaker pairing says', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const id of VOICE_IDS) {
        for (const speaker of SPEAKERS) {
          expect(chooseVoice({ speaker, language, voice: id }), `${language} ${id}`).toBe(
            VOICE_CATALOGUE[language][id],
          );
        }
      }
    }
  });

  it('never lets the administrator replace a voice the trainee chose, only the old pairing', () => {
    const overrides = { female: 'en-US-JennyNeural', male: 'en-US-DavisNeural' };
    expect(chooseVoice({ speaker: 'female', language: 'en-GB', voice: 'voice-a' }, overrides)).toBe(
      'en-GB-SoniaNeural',
    );
    expect(chooseVoice({ speaker: 'female', language: 'en-GB' }, overrides)).toBe(
      'en-US-JennyNeural',
    );
  });

  it('still pairs a voice by speaker when none is chosen, exactly as before', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const speaker of SPEAKERS) {
        expect(chooseVoice({ speaker, language })).toBe(DEFAULT_VOICES[language][speaker]);
        const direction = voiceDirection({ speaker, language, mood: 'calm' });
        expect(direction).not.toHaveProperty('voice');
        expect(direction).not.toHaveProperty('recovering');
        expect(planSpeech('Hello.', direction).voiceId).toBeNull();
      }
    }
  });

  it('plans the chosen voice, and says which choice it was', () => {
    const plan = planSpeech(
      'Hello.',
      voiceDirection({ speaker: 'male', language: 'en-AU', mood: 'calm', voice: 'voice-d' }),
    );
    expect(plan.voice).toBe('en-AU-AnnetteNeural');
    expect(plan.voiceId).toBe('voice-d');
    expect(plan.ssml).toContain('<voice name="en-AU-AnnetteNeural">');
    expect(plan.ssml).toContain('xml:lang="en-AU"');
  });
});

// ---------------------------------------------------------------------------------------
// Restrained delivery

const rateOf = (ssml: string) => Number(/rate="([+-]\d+)%"/.exec(ssml)?.[1]);
const pitchOf = (ssml: string) => {
  const found = /pitch="([+-]\d+)%"/.exec(ssml)?.[1];
  return found === undefined ? null : Number(found);
};

describe('delivery by the customer’s state', () => {
  const rate = (mood: TemperatureBandId, extra: { voice?: VoiceId; recovering?: boolean } = {}) =>
    Number.parseInt(prosodyFor({ ...direction(mood), ...extra }, false).rate, 10);

  it('is a calm, moderate pace for a calm customer, a little quicker for an anxious one, and firmer as the mood heats', () => {
    expect(MOODS.map((mood) => rate(mood))).toEqual([-4, 6, 8, 11, 14]);
    // Never faster than the cap, so nothing sounds rushed or shouted.
    expect(Math.max(...MOODS.map((mood) => rate(mood)))).toBeLessThanOrEqual(MAX_RATE_PERCENT);
  });

  it('keeps an anxious customer’s pitch up a little and a frustrated or angry one’s down a little, never a style on a voice without one', () => {
    const pitch = (mood: TemperatureBandId) => prosodyFor(direction(mood), false).pitch;
    expect(pitch('calm')).toBeNull();
    expect(Number.parseInt(pitch('concerned') ?? '0', 10)).toBeGreaterThan(0);
    for (const mood of ['frustrated', 'angry', 'escalating'] as const) {
      expect(Number.parseInt(pitch(mood) ?? '0', 10)).toBeLessThan(0);
    }
  });

  it('gives each voice choice its own small pace: Measured slowest, Warm a little slow, Concise a little quick, Direct quickest', () => {
    const calm = Object.fromEntries(VOICE_IDS.map((voice) => [voice, rate('calm', { voice })]));
    expect(calm).toEqual({ 'voice-a': -6, 'voice-b': 0, 'voice-c': -10, 'voice-d': -2 });
    expect(calm['voice-c']).toBeLessThan(calm['voice-a'] as number);
    expect(calm['voice-a']).toBeLessThan(calm['voice-d'] as number);
    expect(calm['voice-d']).toBeLessThan(calm['voice-b'] as number);
    // A voice choice never changes pitch: pitch belongs to mood alone.
    for (const mood of MOODS) {
      for (const voice of VOICE_IDS) {
        expect(prosodyFor({ ...direction(mood), voice }, false).pitch).toBe(
          prosodyFor(direction(mood), false).pitch,
        );
      }
    }
  });

  it('is slower and calmer, never louder, for a customer who is recovering, and gradually so as the mood cools', () => {
    for (const mood of MOODS) {
      expect(rate(mood, { recovering: true }), mood).toBeLessThan(rate(mood));
      const plain = prosodyFor(direction(mood), false).pitch;
      const cooling = prosodyFor({ ...direction(mood), recovering: true }, false).pitch;
      expect(Math.abs(Number.parseInt(cooling ?? '0', 10))).toBeLessThanOrEqual(
        Math.abs(Number.parseInt(plain ?? '0', 10)),
      );
    }
    // Cooling down band by band: each step is slower than the one before it.
    const steps = (['frustrated', 'concerned', 'calm'] as const).map((mood) =>
      rate(mood, { recovering: true }),
    );
    expect(steps).toEqual([1, 0, -7]);
    expect(steps[0]).toBeGreaterThan(steps[1] as number);
    expect(steps[1]).toBeGreaterThan(steps[2] as number);
  });

  it('puts no speaking style on a recovering customer, even on a voice that lists one', () => {
    expect(styleFor('en-US-AriaNeural', { ...direction('angry'), recovering: true })).toBeNull();
    const plan = planSpeech(
      'Thank you, that helps.',
      voiceDirection({
        speaker: 'female',
        language: 'en-US',
        mood: 'angry',
        voice: 'voice-b',
        recovering: true,
      }),
    );
    expect(plan.style).toBe('none');
    expect(plan.ssml).not.toContain('express-as');
  });

  it('never leaves the limits, whatever the mood, the recovery, the voice, the language or the intensity', () => {
    for (const language of SPEECH_LANGUAGES) {
      for (const mood of MOODS) {
        for (const voice of [undefined, ...VOICE_IDS]) {
          for (const recovering of [false, true]) {
            const plan = planSpeech(
              'Thanks for calling. I need this fixed.',
              voiceDirection({
                speaker: 'female',
                language,
                mood,
                ...(voice ? { voice } : {}),
                ...(recovering ? { recovering } : {}),
              }),
            );
            const label = `${language} ${mood} ${voice ?? 'old pairing'} ${recovering}`;
            expect(wellFormed(plan.ssml), label).toBe(true);
            expect(rateOf(plan.ssml), label).toBeGreaterThanOrEqual(MIN_RATE_PERCENT);
            expect(rateOf(plan.ssml), label).toBeLessThanOrEqual(MAX_RATE_PERCENT);
            expect(Math.abs(pitchOf(plan.ssml) ?? 0), label).toBeLessThanOrEqual(MAX_PITCH_PERCENT);
            expect(plan.ssml, label).not.toMatch(/shouting|whispering|terrified|excited/);
            const degree = Number(/styledegree="([\d.]+)"/.exec(plan.ssml)?.[1] ?? 0);
            expect(degree, label).toBeLessThanOrEqual(0.9);
            // A style is only ever one a voice lists, and only unfriendly or angry.
            if (plan.style !== 'none') {
              expect(['unfriendly', 'angry']).toContain(plan.style);
              expect(VOICE_STYLES[plan.voice]).toContain(plan.style);
            }
          }
        }
      }
    }
    // Even an out-of-range intensity is held to the limits.
    const wild = prosodyFor({ pace: 'brisk', intensity: 40, voice: 'voice-b' }, false);
    expect(Number.parseInt(wild.rate, 10)).toBeLessThanOrEqual(MAX_RATE_PERCENT);
  });

  it('does not vary pauses, because no pause control was verified, and never writes a break or silence', () => {
    for (const mood of MOODS) {
      const { ssml } = planSpeech('One. Two. Three.', direction(mood, 'female', 'en-US'));
      expect(ssml).not.toMatch(/<break|mstts:silence/);
    }
  });
});

// ---------------------------------------------------------------------------------------
// What is read aloud

describe('what a voice is given to say', () => {
  const spoken = (text: string) => prepareSpokenText(text).text;

  it('is the plain words of the line: markdown is gone', () => {
    expect(
      spoken('**Hello**, I need *help* with `Outlook`. See [the guide](https://x.example/g).'),
    ).toBe('Hello, I need help with Outlook. See the guide.');
    expect(spoken('# Problem\n- cannot sign in\n- every day')).toBe(
      'Problem. cannot sign in. every day',
    );
    expect(spoken('```\nconsole.log(1)\n```Please help.')).toBe('Please help.');
  });

  it('is never JSON', () => {
    expect(spoken('{"mood":"angry","text":"I want a refund"}')).toBe('');
    expect(spoken('I want a refund. {"mood": "angry"} Please.')).toBe('I want a refund. Please.');
    expect(spoken('["a","b"]')).toBe('');
  });

  it('has no stage directions', () => {
    expect(spoken('*sighs* I have been waiting for two days.')).toBe(
      'I have been waiting for two days.',
    );
    expect(spoken('Hello. (long pause) I need help. [pauses]')).toBe('Hello. I need help.');
    expect(spoken('I have been waiting for two days (sighs).')).toBe(
      'I have been waiting for two days.',
    );
  });

  it('has no metadata or notes meant for the simulation', () => {
    expect(spoken('[mood: angry] I am not happy. (state=frustrated) Really.')).toBe(
      'I am not happy. Really.',
    );
    expect(spoken('mood: angry\nI want my money back')).toBe('I want my money back');
    expect(spoken('My email is [email removed], call me on [phone removed].')).not.toMatch(
      /removed|\[/,
    );
  });

  it('has no role labels', () => {
    expect(spoken('Customer: Hello there')).toBe('Hello there');
    expect(spoken('**Customer:** Hello there')).toBe('Hello there');
    expect(spoken('Customer: Hello.\nSupport: Hi.')).toBe('Hello. Hi.');
  });

  it('keeps everything a customer plausibly says, so plain lines are spoken as they were written', () => {
    for (const plain of [
      "I've tried option (b) and it failed twice.",
      'We lost access about three o’clock, and it is costing us money.',
      'It took 5 minutes. Then, nothing: no error, no message.',
      'The other one (the second one) is the one that broke.',
      'Can you check order 4471, please? It is urgent!',
    ]) {
      expect(spoken(plain), plain).toBe(plain);
    }
  });

  it('reaches the SSML only as plain words, and the stored line is left alone', () => {
    const stored = '**Customer:** *sighs* I need [help](https://x.example) {"mood":"angry"}';
    const plan = planSpeech(stored, direction('frustrated'));
    expect(plan.text).toBe('I need help');
    for (const leak of ['Customer', 'sighs', 'x.example', 'mood', '*', '{', '[']) {
      expect(plan.ssml).not.toContain(leak);
    }
    expect(stored).toBe('**Customer:** *sighs* I need [help](https://x.example) {"mood":"angry"}');
  });

  it('is cleaned once, so a second pass changes nothing', () => {
    for (const text of ['**a** *b* (c d) [mood: x]', 'Hello. (pause) Hello there. [sighs]', '']) {
      const once = prepareSpokenText(text).text;
      expect(prepareSpokenText(once).text).toBe(once);
    }
  });
});
