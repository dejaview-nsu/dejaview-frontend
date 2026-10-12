import { afterEach, describe, expect, it, vi } from "vitest";

import { fileConstraints } from "@/features/search-by-file";

import { FileValidationError, validateFileSelection, validateMediaFile } from "@/shared/lib/files";

const file = (name = "frame.png", type = "image/png", size = 5) => {
  const result = new File(["image"], name, { type });
  Object.defineProperty(result, "size", { value: size });
  return result;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("media selection limits", () => {
  it.each(["jpg", "jpeg", "png", "webp"])(
    "accepts image %s, including uppercase extensions and empty MIME",
    (extension) => {
      expect(
        validateFileSelection([file(`frame.${extension.toUpperCase()}`, "")], fileConstraints.image),
      ).toBeInstanceOf(File);
    },
  );
  it.each(["mp4", "mov", "webm"])("accepts video %s", (extension) => {
    expect(validateFileSelection([file(`scene.${extension}`, "")], fileConstraints.video)).toBeInstanceOf(File);
  });
  it.each(["image", "video"] as const)("accepts exact size boundary and rejects one extra byte for %s", (mode) => {
    const constraints = fileConstraints[mode];
    const name = mode === "image" ? "frame.png" : "scene.mp4";
    expect(() => validateFileSelection([file(name, "", constraints.maxBytes)], constraints)).not.toThrow();
    expect(() => validateFileSelection([file(name, "", constraints.maxBytes + 1)], constraints)).toThrow(/Размер/);
  });
  it("rejects empty, missing, multiple files and MIME/extension mismatch", () => {
    for (const files of [
      [],
      [file(), file()],
      [file("frame.png", "image/png", 0)],
      [file("frame.gif", "image/gif")],
      [file("frame.png", "video/mp4")],
    ]) {
      expect(() => validateFileSelection(files, fileConstraints.image)).toThrow(FileValidationError);
    }
  });
});

describe("media decoding", () => {
  const urls = () => {
    const revoke = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke);
    return revoke;
  };
  it("rejects damaged image and releases its object URL", async () => {
    const revoke = urls();
    vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (this: HTMLImageElement, value) {
      if (value) queueMicrotask(() => this.dispatchEvent(new Event("error")));
    });
    await expect(validateMediaFile([file()], fileConstraints.image)).rejects.toThrow(/повреждён/);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
  it.each([30, 30.01, Infinity, 0])("checks duration %s seconds and releases video resource", async (duration) => {
    const revoke = urls();
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "src", "set").mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "duration", { value: duration });
      queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
    });
    const promise = validateMediaFile([file("scene.mp4", "video/mp4")], fileConstraints.video);
    if (duration === 30) await expect(promise).resolves.toBeUndefined();
    else await expect(promise).rejects.toThrow(FileValidationError);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
  it("times out unreadable files and releases URL", async () => {
    vi.useFakeTimers();
    const revoke = urls();
    const promise = validateMediaFile([file()], fileConstraints.image);
    const assertion = expect(promise).rejects.toThrow(/Не удалось прочитать/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});
