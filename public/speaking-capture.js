class SpeakingCapture extends AudioWorkletProcessor {
 constructor() { super(); this.samples = []; this.phase = 0; this.sum = 0; this.count = 0; }
 process(inputs) {
  const input = inputs[0]?.[0]; if (!input) return true;
  for (const value of input) {
   this.sum += value; this.count++;
   this.phase += 16000;
   if (this.phase >= sampleRate) {
    this.phase -= sampleRate;
    this.samples.push(Math.round(Math.max(-1, Math.min(1, this.sum / this.count)) * 32767));
    this.sum = 0; this.count = 0;
    if (this.samples.length === 1600) {
     const bytes = new ArrayBuffer(3200), view = new DataView(bytes);
     this.samples.forEach((v, i) => view.setInt16(i * 2, v, true));
     this.port.postMessage(bytes, [bytes]); this.samples = [];
    }
   }
  }
  return true;
 }
}
registerProcessor('speaking-capture', SpeakingCapture);
