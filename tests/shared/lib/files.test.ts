import { afterEach, describe, expect, it, vi } from "vitest";

import { fileConstraints } from "@/features/search-by-file";
import { videoConstraints } from "@/features/search-by-video";

import {
  FileValidationError,
  getFileExtension,
  readVideoDuration,
  validateFileSelection,
  validateMediaFile,
} from "@/shared/lib/files";

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
    expect(validateFileSelection([file(`scene.${extension}`, "")], videoConstraints)).toBeInstanceOf(File);
  });
  it.each(["image", "video"] as const)("accepts exact size boundary and rejects one extra byte for %s", (mode) => {
    const constraints = { image: fileConstraints.image, video: videoConstraints }[mode];
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
  it.each([
    ["scene.MP4", "mp4"],
    ["archive.tar.webm", "webm"],
    ["no-extension", ""],
    ["trailing.", ""],
  ])("reads the extension of %s", (name, extension) => {
    expect(getFileExtension(file(name))).toBe(extension);
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

describe("video duration", () => {
  const urls = () => {
    const revoke = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:video");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    return revoke;
  };

  const metadata = (duration: number, event = "loadedmetadata") =>
    vi.spyOn(HTMLMediaElement.prototype, "src", "set").mockImplementation(function (this: HTMLMediaElement, value) {
      if (!value) return;
      Object.defineProperty(this, "duration", { value: duration, configurable: true });
      queueMicrotask(() => this.dispatchEvent(new Event(event)));
    });

  it("reads metadata only and releases the object URL", async () => {
    const revoke = urls();
    metadata(24.4);
    await expect(readVideoDuration(file("scene.mp4", "video/mp4"))).resolves.toBe(24.4);
    expect(revoke).toHaveBeenCalledWith("blob:video");
  });

  it("rejects a video the browser cannot open and releases the object URL", async () => {
    const revoke = urls();
    metadata(0, "error");
    await expect(readVideoDuration(file("scene.mp4", "video/mp4"))).rejects.toThrow();
    expect(revoke).toHaveBeenCalledWith("blob:video");
  });

  it("waits for a recalculated duration when metadata reports infinity", async () => {
    urls();
    metadata(Infinity);
    vi.spyOn(HTMLMediaElement.prototype, "currentTime", "set").mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, "duration", { value: 12, configurable: true });
      queueMicrotask(() => this.dispatchEvent(new Event("durationchange")));
    });
    await expect(readVideoDuration(file("record.webm", "video/webm"))).resolves.toBe(12);
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    const revoke = urls();
    const assertion = expect(readVideoDuration(file("scene.mp4", "video/mp4"), 5_000)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(revoke).toHaveBeenCalledWith("blob:video");
  });
});
