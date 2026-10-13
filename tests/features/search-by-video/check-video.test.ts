import { describe, expect, it, vi } from "vitest";

import { checkVideo, videoCheckChips, videoCheckMessages, videoCheckTitle } from "@/features/search-by-video";

const video = (name = "scene.mp4", type = "video/mp4", size = 1024) => new File([new Uint8Array(size)], name, { type });

const duration = (seconds: number) => vi.fn(async () => seconds);

describe("video checks before search", () => {
  it("passes one supported file and returns its duration", async () => {
    const file = video();
    const read = duration(24);
    await expect(checkVideo([file], read)).resolves.toEqual({ ok: true, file, durationSeconds: 24 });
    expect(read).toHaveBeenCalledWith(file);
  });

  it.each([
    ["missing", []],
    ["multiple", [video(), video("other.mov", "video/quicktime")]],
    ["tooLarge", [video("big.mp4", "video/mp4", 50 * 1024 * 1024 + 1)]],
    ["format", [video("scene.avi", "video/x-msvideo")]],
    ["format", [video("scene.mp4", "image/png")]],
  ] as const)("rejects %s without opening the video", async (reason, files) => {
    const read = duration(10);
    await expect(checkVideo(files, read)).resolves.toEqual({ ok: false, reason });
    expect(read).not.toHaveBeenCalled();
  });

  it("accepts the size limit exactly and an empty MIME type for allowed extensions", async () => {
    await expect(checkVideo([video("edge.MOV", "", 50 * 1024 * 1024)], duration(30))).resolves.toMatchObject({
      ok: true,
    });
  });

  it("rejects a fragment longer than 30 seconds and keeps its duration", async () => {
    await expect(checkVideo([video()], duration(30.5))).resolves.toEqual({
      ok: false,
      reason: "tooLong",
      durationSeconds: 30.5,
    });
  });

  it("treats a video that cannot be opened as corrupted", async () => {
    const read = vi.fn(async () => {
      throw new Error("decode");
    });
    await expect(checkVideo([video()], read)).resolves.toEqual({ ok: false, reason: "corrupted" });
  });

  it.each([
    ["multiple", [video("big.mp4", "video/mp4", 60 * 1024 * 1024), video("other.avi", "video/x-msvideo")]],
    ["format", [video("long.avi", "video/x-msvideo")]],
  ] as const)("follows the contract order and reports %s first", async (reason, files) => {
    const read = duration(47);
    await expect(checkVideo(files, read)).resolves.toEqual({ ok: false, reason });
    expect(read).not.toHaveBeenCalled();
  });

  it("checks size before format, as the contract orders them", async () => {
    await expect(checkVideo([video("big.avi", "video/x-msvideo", 60 * 1024 * 1024)], duration(5))).resolves.toEqual({
      ok: false,
      reason: "tooLarge",
    });
  });

  it("keeps the agreed texts for every check", () => {
    expect(videoCheckTitle).toBe("Не получилось начать поиск");
    expect(videoCheckMessages).toEqual({
      missing: "Сначала добавьте видеофрагмент: нажмите «Выбрать файл».",
      multiple: "Можно искать только по одному видеофрагменту. Выберите один файл.",
      tooLarge: "Файл больше 50 МБ. Сожмите видео или выберите фрагмент покороче.",
      format: "Этот формат не подходит. Загрузите видео в формате MP4, MOV или WEBM.",
      tooLong: "Фрагмент длиннее 30 секунд. Обрежьте видео до самой узнаваемой сцены или выберите другой файл.",
      corrupted: "Не удалось открыть видео — возможно, файл поврежден. Попробуйте другой файл.",
    });
    expect(videoCheckChips).toEqual({
      tooLarge: "Файл больше 50 МБ",
      format: "Формат не подходит",
      tooLong: "Фрагмент длиннее 30 секунд",
      corrupted: "Файл поврежден",
    });
  });
});
