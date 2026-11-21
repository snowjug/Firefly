import { MOCK_UTTERANCES } from '../../server/speech/mock.ts';

// What the server's mock speech provider says when it "hears" the trainee. It ignores the audio it
// is given: every recording of 150 ms or more is answered with the next of these eight sentences,
// in order and then round again, and the position is shared by the whole server process, so by every
// test. The words of a spoken turn are therefore never predictable: only that they are one of these.
//
//   expect(isMockUtterance(spokenText)).toBe(true);
//
// This proves the call sends what the speech service returns, word for word, into the transcript.
// It proves nothing about recognising a real voice.

export { MOCK_UTTERANCES };

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The sentences the mock provider can return, as the transcript shows them. */
export const MOCK_SENTENCES: readonly string[] = MOCK_UTTERANCES.map(squash);

export function isMockUtterance(text: string): boolean {
  return MOCK_SENTENCES.includes(squash(text));
}
