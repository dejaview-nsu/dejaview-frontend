export type AudioRecording = { stop: () => Promise<File>; cancel: () => void };

export const encodeWav = (buffer: AudioBuffer): File => {
  // Clamp encoder padding to the recording limit, including delayed background-tab timers.
  const frames = Math.min(buffer.length, buffer.sampleRate * 10);
  const channels = buffer.numberOfChannels;
  const bytes = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(bytes);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
  };

  writeText(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, frames * channels * 2, true);

  const samples = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));

  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.max(-1, Math.min(1, samples[channel][frame]));
      view.setInt16(44 + (frame * channels + channel) * 2, value * (value < 0 ? 0x8000 : 0x7fff), true);
    }
  }

  return new File([bytes], "Запись с микрофона.wav", { type: "audio/wav" });
};

export const startAudioRecording = async ({
  signal,
  onElapsed,
  onLimit,
  onError,
  onLevel = () => undefined,
}: {
  signal: AbortSignal;
  onElapsed: (seconds: number) => void;
  onLimit: () => void;
  onError: () => void;
  onLevel?: (level: number) => void;
}): Promise<AudioRecording> => {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined" ||
    typeof AudioContext === "undefined"
  )
    throw new DOMException("Recording unavailable", "NotSupportedError");

  signal.throwIfAborted();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  let recorder: MediaRecorder | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let released = false;
  let finished = false;
  let stopPromise: Promise<File> | null = null;

  const cleanup = () => {
    if (released) return;
    released = true;
    if (timer !== null) clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    destination?.stream.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    if (context) void context.close();
    signal.removeEventListener("abort", cancel);
  };
  const cancel = () => {
    finished = true;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    cleanup();
  };

  signal.addEventListener("abort", cancel, { once: true });

  try {
    if (signal.aborted) cancel();
    signal.throwIfAborted();
    context = new AudioContext();
    await context.resume();
    signal.throwIfAborted();
    source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    destination = context.createMediaStreamDestination();
    source.connect(analyser);
    // Keep the capture graph running without playing the microphone through the speakers.
    analyser.connect(destination);

    const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const activeRecorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
    recorder = activeRecorder;
    const chunks: Blob[] = [];

    activeRecorder.ondataavailable = ({ data }) => {
      if (!finished && data.size > 0) chunks.push(data);
    };
    activeRecorder.onerror = () => {
      cancel();
      onError();
    };
    activeRecorder.start();
    const startedAt = performance.now();
    const levels = new Float32Array(analyser.fftSize);

    timer = setInterval(() => {
      const elapsed = Math.min(10, (performance.now() - startedAt) / 1000);
      analyser.getFloatTimeDomainData(levels);
      let peak = 0;
      for (const value of levels) peak = Math.max(peak, Math.abs(value));
      onLevel(peak);
      onElapsed(elapsed);
      if (elapsed >= 10) {
        if (timer !== null) clearInterval(timer);
        onLimit();
      }
    }, 100);

    const stop = (): Promise<File> => {
      if (stopPromise) return stopPromise;
      if (finished || signal.aborted) return Promise.reject(new DOMException("Recording cancelled", "AbortError"));

      stopPromise = new Promise<Blob>((resolve, reject) => {
        const abort = () => reject(new DOMException("Recording cancelled", "AbortError"));
        signal.addEventListener("abort", abort, { once: true });
        activeRecorder.onerror = () => {
          signal.removeEventListener("abort", abort);
          cleanup();
          reject(new Error("Recording failed"));
        };
        activeRecorder.onstop = () => {
          signal.removeEventListener("abort", abort);
          cleanup();
          if (finished || signal.aborted) abort();
          else resolve(new Blob(chunks, { type: activeRecorder.mimeType }));
        };
        activeRecorder.stop();
      }).then(async (blob) => {
        signal.throwIfAborted();
        const decoder = new AudioContext();

        try {
          const buffer = await decoder.decodeAudioData(await blob.arrayBuffer());
          signal.throwIfAborted();
          if (buffer.length === 0) throw new Error("Empty recording");
          const hasSignal = Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
            buffer.getChannelData(channel),
          ).some((samples) => samples.some((value) => Math.abs(value) >= 1 / 32768));
          if (!hasSignal) throw new DOMException("Microphone provided silence", "NoAudioSignalError");
          return encodeWav(buffer);
        } finally {
          await decoder.close();
        }
      });

      return stopPromise;
    };

    return { stop, cancel };
  } catch (error) {
    cancel();
    throw error;
  }
};
