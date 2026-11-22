// Every number that decides when a spoken turn starts, when it ends, and when what was heard is
// thrown away as noise, in one place. The detector, the server capture and the browser recognition
// all read them from here, and the call machine's own timers (its `TIMINGS`) sit around them.
//
// Turn-taking is controlled, not interruptive: the trainee speaks after the customer has finished,
// and a pause to think must not be taken for the end of their turn. So the end of a turn waits for
// a generous silence, and the trainee can always end it sooner with "Done speaking". Silence alone
// never ends listening: the microphone stays open between turns until the trainee mutes, pauses or
// ends the call (the call machine's own timers, in `TIMINGS`, only soften and finally pause that).

export const CAPTURE_TUNING = {
  // --- Finding speech -------------------------------------------------------------------
  /** Audio is cut into frames this long, and each frame's loudness is judged on its own. */
  frameMs: 20,
  /** Speech starts after this long above the start threshold, so a single click never starts it. */
  speechStartMs: 120,
  /** The start threshold is this many times the room's noise floor. */
  startRatio: 3,
  /** The stop threshold is this many times the noise floor: lower, so a word that dips does not end speech. */
  stopRatio: 1.8,
  /** The start threshold is never lower than this loudness (RMS, 0 to 1). */
  minStartRms: 0.006,

  // --- Ending a turn --------------------------------------------------------------------
  /**
   * How long the trainee must be quiet before their turn ends by itself. Long enough for a pause to
   * think mid-sentence (most pauses are under a second), short enough that the customer answers
   * soon after. "Done speaking" ends a turn at once.
   */
  endpointSilenceMs: 1400,
  /** Audio kept from before the start was noticed, so the first word is not clipped. */
  preRollMs: 300,
  /** Silence kept after the last word. */
  tailMs: 300,
  /** The longest single turn. It is cut here, sent, and listening carries on. */
  maxUtteranceMs: 30_000,

  // --- Throwing away what is not a turn ---------------------------------------------------
  /** Speech shorter than this, from first sound to last, is a cough, a click or a bump. */
  minSpeechMs: 400,
  /** Of that, at least this much must be voiced: a few scattered clicks are not speech. */
  minVoicedMs: 250,
  /** An utterance whose loudest moment is quieter than this (RMS, 0 to 1) is only room noise. */
  minSpeechRms: 0.015,

  // --- The browser's own recognition ------------------------------------------------------
  // The browser's recogniser ends its sessions by itself (after quiet, and after a minute or so), so
  // one listening pass restarts them without the trainee noticing. The end of a turn is still
  // `endpointSilenceMs` above, decided by Firefly and not by the browser.
  /** The pause before a session that ended is started again. */
  recognitionRestartMs: 250,
  /**
   * A session that ends by itself (with no error) sooner than this, without any words, did not show
   * that the recogniser works; one that lives at least this long does. A session that ends with an
   * error counts as failed however long it lived, and the browser's own "no speech" (a quiet room)
   * is never a failure, however soon it comes.
   */
  recognitionMinLifeMs: 3000,
  /**
   * This many sessions in a row that did not show the recogniser works (ended by an error, or by
   * themselves within `recognitionMinLifeMs` without words) end the pass with a failure, so a restart
   * loop of failing sessions is impossible. A session that produces words, ends with "no speech" or
   * lives long enough starts the count again.
   */
  recognitionMaxFailedSessions: 4,
  /**
   * After "Done speaking", how long to wait for the browser to hand back what it had captured but not
   * yet turned into words (`stop()` returns a result from the audio so far, normally within a
   * moment, where `abort()` returns none). Short, because the button is meant to be fast, and
   * shorter than the call machine's own wait for a finish request (`TIMINGS.finish`, 5 s), so the
   * recogniser always answers first.
   */
  recognitionStopWaitMs: 2000,

  // --- Taking turns ---------------------------------------------------------------------
  /**
   * How long after the customer's voice ends before the microphone may open, so it does not hear
   * the tail of the customer's voice or a speaker's echo. The call machine uses the same figure.
   */
  settleAfterPlaybackMs: 350,
} as const;

export type CaptureTuning = typeof CAPTURE_TUNING;
