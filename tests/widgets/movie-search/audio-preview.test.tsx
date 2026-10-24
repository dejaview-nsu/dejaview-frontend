import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioPreview } from "@/widgets/movie-search/ui/audio-preview";

import { userEventSetup } from "../../test-utils";

const file = (name = "voice.wav") => new File(["wav"], name, { type: "audio/wav" });

afterEach(() => vi.restoreAllMocks());

describe("audio playback controls", () => {
  it("plays and pauses the same unmuted audio element and follows playback time", async () => {
    let paused = true;
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      paused = false;
      fireEvent.play(this);
      return Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
      paused = true;
      fireEvent.pause(this);
    });
    render(<AudioPreview file={file()} durationSeconds={8} />);
    const element = screen.getByLabelText<HTMLAudioElement>("Прослушать voice.wav");
    const user = userEventSetup();
    await user.click(screen.getByRole("button", { name: "Воспроизвести фрагмент" }));
    expect(play).toHaveBeenCalledOnce();
    expect(element.muted).toBe(false);
    expect(screen.getByRole("button", { name: "Приостановить фрагмент" })).toBeEnabled();
    element.currentTime = 4;
    fireEvent.timeUpdate(element);
    expect(screen.getByRole("slider")).toHaveValue("4");
    await user.click(screen.getByRole("button", { name: "Приостановить фрагмент" }));
    expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Воспроизвести фрагмент" })).toBeEnabled();
  });

  it("seeks from the waveform and resets playback after file replacement", async () => {
    const first = file();
    const { rerender } = render(<AudioPreview file={first} durationSeconds={8} />);
    const element = screen.getByLabelText<HTMLAudioElement>("Прослушать voice.wav");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    expect(element.currentTime).toBe(3);
    rerender(<AudioPreview file={file("replacement.wav")} durationSeconds={2} />);
    await waitFor(() => expect(screen.getByRole("slider")).toHaveValue("0"));
    expect(screen.getByLabelText("Прослушать replacement.wav")).toHaveAttribute("src");
  });

  it("shows an actionable error if the browser refuses playback", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new DOMException("Cannot play", "NotSupportedError"),
    );
    render(<AudioPreview file={file()} durationSeconds={8} />);
    await userEventSetup().click(screen.getByRole("button", { name: "Воспроизвести фрагмент" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось воспроизвести фрагмент");
  });
});
