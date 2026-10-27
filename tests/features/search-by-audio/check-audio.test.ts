import { describe, expect, it, vi } from "vitest";

import { audioConstraints, checkAudio } from "@/features/search-by-audio";

const file = (name = "clip.mp3", type = "audio/mpeg", size = 10) => new File([new Uint8Array(size)], name, { type });

describe("audio validation", () => {
  it.each([
    ["mp3", "audio/mpeg"],
    ["wav", "audio/wav"],
    ["ogg", "audio/ogg"],
    ["m4a", "audio/mp4"],
    ["MP3", ""],
  ])("accepts %s at the duration boundary", async (extension, type) => {
    const clip = file(`clip.${extension}`, type);
    expect(await checkAudio([clip], async () => 10)).toEqual({ ok: true, file: clip, durationSeconds: 10 });
  });

  it("accepts exactly 20 MiB", async () => {
    expect(await checkAudio([file("clip.wav", "audio/wav", audioConstraints.maxBytes)], async () => 1)).toMatchObject({
      ok: true,
    });
  });

  it.each([
    [[], "missing"],
    [[file(), file()], "multiple"],
    [[file("clip.mp3", "audio/mpeg", audioConstraints.maxBytes + 1)], "tooLarge"],
    [[file("clip.webm", "audio/webm")], "format"],
    [[file("clip.mp3", "video/mp4")], "format"],
    [[file("clip.mp3", "audio/mpeg", 0)], "corrupted"],
  ] as const)("rejects invalid selection before decoding: %s", async (files, reason) => {
    const read = vi.fn();
    expect(await checkAudio(files, read)).toEqual({ ok: false, reason });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, -1])("rejects invalid duration %s", async (duration) => {
    expect(await checkAudio([file()], async () => duration)).toEqual({ ok: false, reason: "corrupted" });
  });

  it("rejects duration above ten seconds", async () => {
    expect(await checkAudio([file()], async () => 10.001)).toEqual({
      ok: false,
      reason: "tooLong",
      durationSeconds: 10.001,
    });
  });

  it("reports decode failure", async () => {
    expect(
      await checkAudio([file()], async () => {
        throw new Error("decode");
      }),
    ).toEqual({ ok: false, reason: "corrupted" });
  });
});
