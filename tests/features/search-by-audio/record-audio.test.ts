// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodeWav, startAudioRecording } from "@/features/search-by-audio/lib/record-audio";

const buffer = (seconds = 2, channels = 1): AudioBuffer =>
  ({
    length: seconds * 8000,
    sampleRate: 8000,
    duration: seconds,
    numberOfChannels: channels,
    getChannelData: () => new Float32Array(seconds * 8000).fill(0.5),
  }) as unknown as AudioBuffer;

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = (type: string) => type.startsWith("audio/webm");
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  constructor(readonly stream: unknown) {
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["webm"]) });
      this.onstop?.();
    });
  }
}

const trackStop = vi.fn();
const stream = { getTracks: () => [{ stop: trackStop }] };
const routedStop = vi.fn();
const routedStream = { getTracks: () => [{ stop: routedStop }] };
const connect = vi.fn();
const disconnect = vi.fn();
const resume = vi.fn(async (): Promise<void> => undefined);
const close = vi.fn(async () => undefined);
const decode = vi.fn(async () => buffer());

beforeEach(() => {
  vi.clearAllMocks();
  FakeRecorder.instances = [];
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = resume;
      createMediaStreamSource = vi.fn(() => ({ connect, disconnect }));
      createAnalyser = vi.fn(() => ({
        fftSize: 32,
        connect,
        getFloatTimeDomainData: (samples: Float32Array) => samples.fill(0.5),
      }));
      createMediaStreamDestination = vi.fn(() => ({ stream: routedStream }));
      decodeAudioData = decode;
      close = close;
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const start = (controller = new AbortController(), onLimit = vi.fn(), onError = vi.fn()) =>
  startAudioRecording({
    signal: controller.signal,
    onElapsed: vi.fn(),
    onLimit,
    onError,
  });

describe("browser audio recording", () => {
  it("converts the browser WEBM recording to a real PCM WAV and releases the microphone", async () => {
    const recording = await start();
    const file = await recording.stop();
    const bytes = new DataView(await file.arrayBuffer());
    expect(resume).toHaveBeenCalledOnce();
    expect(FakeRecorder.instances[0].stream).toBe(routedStream);
    expect(routedStop).toHaveBeenCalledOnce();
    expect(file.type).toBe("audio/wav");
    expect(file.name).toMatch(/\.wav$/);
    expect(new TextDecoder().decode(bytes.buffer.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.buffer.slice(8, 12))).toBe("WAVE");
    expect(bytes.getUint16(20, true)).toBe(1);
    expect(bytes.getUint32(24, true)).toBe(8000);
    expect(file.size).toBe(44 + 2 * 8000 * 2);
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("clamps encoder padding to ten seconds with correct stereo interleaving", async () => {
    const file = encodeWav(buffer(11, 2));
    const view = new DataView(await file.arrayBuffer());
    expect(file.size).toBe(44 + 10 * 8000 * 2 * 2);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getInt16(44, true)).toBe(16383);
    expect(view.getInt16(46, true)).toBe(16383);
  });

  it("stops the microphone on cancellation and refuses to encode", async () => {
    const controller = new AbortController();
    const recording = await start(controller);
    controller.abort();
    await expect(recording.stop()).rejects.toMatchObject({ name: "AbortError" });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(decode).not.toHaveBeenCalled();
  });

  it("releases a microphone granted after cancellation", async () => {
    let grant!: (value: typeof stream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((resolve) => {
            grant = resolve;
          }),
      },
    });
    const controller = new AbortController();
    const promise = start(controller);
    controller.abort();
    grant(stream);
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it("fires the limit once at ten seconds", async () => {
    vi.useFakeTimers();
    const onLimit = vi.fn();
    const recording = await start(new AbortController(), onLimit);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onLimit).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onLimit).toHaveBeenCalledOnce();
    recording.cancel();
    expect(trackStop).toHaveBeenCalledOnce();
  });

  it("releases resources when decoding fails", async () => {
    decode.mockRejectedValueOnce(new Error("decode failed"));
    const recording = await start();
    await expect(recording.stop()).rejects.toThrow("decode failed");
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("reports recording device errors and releases the stream", async () => {
    const onError = vi.fn();
    await start(new AbortController(), vi.fn(), onError);
    FakeRecorder.instances[0].onerror?.();
    expect(onError).toHaveBeenCalledOnce();
    expect(trackStop).toHaveBeenCalledOnce();
  });

  it("rejects a silent microphone recording instead of producing a successful empty WAV", async () => {
    decode.mockResolvedValueOnce({ ...buffer(), getChannelData: () => new Float32Array(16000) });
    const recording = await start();
    await expect(recording.stop()).rejects.toMatchObject({ name: "NoAudioSignalError" });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("releases tracks and the audio graph when resuming fails", async () => {
    resume.mockRejectedValueOnce(new Error("resume failed"));
    await expect(start()).rejects.toThrow("resume failed");
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("cancels while the capture context is resuming and frees the microphone", async () => {
    let finish!: () => void;
    resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = start(controller);
    await vi.waitFor(() => expect(finish).toBeDefined());
    controller.abort();
    expect(trackStop).toHaveBeenCalledOnce();
    finish();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports unsupported APIs without requesting a microphone", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    await expect(start()).rejects.toMatchObject({ name: "NotSupportedError" });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
