/* global AudioWorkletProcessor, registerProcessor, sampleRate */

// Runs on the browser's audio thread. While the page has asked it to listen, it copies the
// microphone's samples into blocks of about 20 ms and posts each block to the page, which hands
// them to the voice-activity detector. It keeps nothing: when told to stop, anything it was holding
// is discarded, and it only ever talks to the page that loaded it.

const BLOCK_SAMPLES = Math.max(128, Math.round(sampleRate * 0.02));

class FireflyCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.listening = false;
    this.closed = false;
    this.block = new Float32Array(BLOCK_SAMPLES);
    this.filled = 0;
    this.port.onmessage = (event) => {
      const command = event.data && event.data.type;
      if (command === 'start') {
        this.listening = true;
      } else if (command === 'stop') {
        this.listening = false;
      } else if (command === 'close') {
        this.listening = false;
        this.closed = true;
      }
      this.filled = 0;
    };
  }

  process(inputs) {
    if (this.closed) return false;
    if (!this.listening) return true;
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const count = Math.min(channel.length - offset, this.block.length - this.filled);
      this.block.set(channel.subarray(offset, offset + count), this.filled);
      this.filled += count;
      offset += count;
      if (this.filled === this.block.length) {
        const full = this.block;
        this.block = new Float32Array(BLOCK_SAMPLES);
        this.filled = 0;
        this.port.postMessage(full, [full.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('firefly-capture', FireflyCapture);
