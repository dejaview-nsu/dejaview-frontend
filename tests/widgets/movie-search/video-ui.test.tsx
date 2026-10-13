import { render, screen, within } from "@testing-library/react";
import { RefreshCw } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { SearchNotice } from "@/widgets/movie-search/ui/search-notice";
import { VideoFileCard } from "@/widgets/movie-search/ui/video-file-card";
import { formatDuration } from "@/widgets/movie-search/ui/video-preview";
import { VideoSearchEmpty } from "@/widgets/movie-search/ui/video-search-empty";
import { VideoSearchStages } from "@/widgets/movie-search/ui/video-search-stages";

import { videoCheckTitle, videoSearchTexts } from "@/features/search-by-video";

import { userEventSetup } from "../../test-utils";

const video = () =>
  new File([new Uint8Array(Math.round(1024 * 1024 * 38.6))], "scena_iz_filma.mp4", { type: "video/mp4" });

describe("video file card", () => {
  it("shows name, format and size with the ready status and enabled actions", async () => {
    const replace = vi.fn();
    const remove = vi.fn();
    render(
      <VideoFileCard
        file={video()}
        durationSeconds={24}
        status="ready"
        isBusy={false}
        onReplace={replace}
        onRemove={remove}
      />,
    );
    expect(screen.getByText("scena_iz_filma.mp4")).toBeInTheDocument();
    expect(screen.getByText("MP4 · 0:24 · 38,6 МБ")).toBeInTheDocument();
    expect(screen.getByText("0:24")).toBeInTheDocument();
    expect(screen.getByText("Файл подходит — можно начинать поиск")).toBeInTheDocument();
    const user = userEventSetup();
    await user.click(screen.getByRole("button", { name: "Заменить" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(replace).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("shows the short check message and keeps actions for another try", () => {
    render(
      <VideoFileCard
        file={video()}
        durationSeconds={47.9}
        status="invalid"
        message="Фрагмент длиннее 30 секунд"
        isBusy={false}
        onReplace={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("Фрагмент длиннее 30 секунд")).toBeInTheDocument();
    expect(screen.getByText("MP4 · 0:47 · 38,6 МБ")).toBeInTheDocument();
    expect(screen.queryByText("Файл подходит — можно начинать поиск")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Заменить" })).toBeEnabled();
  });

  it("locks actions and reports progress while the request is running", () => {
    render(
      <VideoFileCard
        file={video()}
        durationSeconds={24}
        status="uploading"
        isBusy
        onReplace={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("Загружаем видео…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Заменить" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeDisabled();
  });
});

describe("video duration", () => {
  it.each([
    [30.4, "0:30"],
    [30.9, "0:30"],
    [59.99, "0:59"],
    [61, "1:01"],
  ])("rounds %s seconds down to %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });

  it("shows no duration until the check reports it", () => {
    render(
      <VideoFileCard
        file={video()}
        durationSeconds={null}
        status="checking"
        isBusy={false}
        onReplace={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("MP4 · 38,6 МБ")).toBeInTheDocument();
  });
});

describe("video search stages", () => {
  it("uploading shows percent, loaded size, waiting second stage and cancels the upload", async () => {
    const cancel = vi.fn();
    render(<VideoSearchStages stage="uploading" progress={64} file={video()} durationSeconds={24} onCancel={cancel} />);
    expect(screen.getByRole("heading", { name: "Загружаем видео…" })).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Этап 1: загрузка" })).toHaveAttribute("aria-valuenow", "64");
    expect(screen.getByText("24,7 из 38,6 МБ")).toBeInTheDocument();
    expect(screen.getByText("Начнется сразу после загрузки")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отменить поиск" })).not.toBeInTheDocument();
    await userEventSetup().click(screen.getByRole("button", { name: "Отменить загрузку" }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("unknown upload progress uses an indeterminate bar without a value", () => {
    render(
      <VideoSearchStages stage="uploading" progress={null} file={video()} durationSeconds={24} onCancel={() => {}} />,
    );
    const bar = screen.getByRole("progressbar", { name: "Этап 1: загрузка" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar.firstElementChild).toHaveClass("motion-safe:animate-progress-indeterminate");
    expect(screen.queryByText(/из 38,6 МБ/)).not.toBeInTheDocument();
  });

  it("processing marks the upload as done and cancels the search separately", async () => {
    const cancel = vi.fn();
    render(
      <VideoSearchStages stage="processing" progress={100} file={video()} durationSeconds={24} onCancel={cancel} />,
    );
    expect(screen.getByRole("heading", { name: "Ищем фильм по фрагменту…" })).toBeInTheDocument();
    expect(screen.getByText("Видео загружено")).toBeInTheDocument();
    expect(screen.getByText("38,6 из 38,6 МБ")).toBeInTheDocument();
    expect(screen.getByText("Сравниваем фрагмент с фильмами каталога")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Этап 2: поиск фильма" })).not.toHaveAttribute("aria-valuenow");
    expect(screen.queryByRole("button", { name: "Отменить загрузку" })).not.toBeInTheDocument();
    await userEventSetup().click(screen.getByRole("button", { name: "Отменить поиск" }));
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("video search messages", () => {
  it("empty result offers another video through the file input and a repeated search", async () => {
    const again = vi.fn();
    render(<VideoSearchEmpty fileInputId="video-file" onSearchAgain={again} />);
    expect(screen.getByRole("heading", { name: "Не удалось узнать фильм" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Выбрать другое видео" })).toHaveAttribute("for", "video-file");
    await userEventSetup().click(screen.getByRole("button", { name: "Искать снова" }));
    expect(again).toHaveBeenCalledOnce();
  });

  it("error notice is an alert with the shared title and a file action bound to the input", () => {
    render(
      <SearchNotice
        tone="error"
        title={videoCheckTitle}
        message="Файл больше 50 МБ. Сожмите видео или выберите фрагмент покороче."
        actionLabel={videoSearchTexts.chooseAnotherFile}
        fileInputId="video-file"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("bg-error-bg", "border-error-text");
    expect(within(alert).getByRole("heading", { name: "Не получилось начать поиск" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Выбрать другой файл" })).toHaveAttribute("for", "video-file");
  });

  it("unavailable notice uses the warning tone and retries", async () => {
    const retry = vi.fn();
    render(
      <SearchNotice
        tone="warning"
        title={videoSearchTexts.unavailableTitle}
        message={videoSearchTexts.unavailableText}
        actionLabel={videoSearchTexts.retry}
        ActionIcon={RefreshCw}
        onAction={retry}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("bg-warning-bg", "border-warning-text");
    expect(within(alert).getByRole("heading", { name: "Поиск временно недоступен" })).toBeInTheDocument();
    expect(
      within(alert).getByText(
        "Мы уже разбираемся. Попробуйте еще раз через несколько минут — видеофрагмент сохранится",
      ),
    ).toBeInTheDocument();
    await userEventSetup().click(within(alert).getByRole("button", { name: "Повторить" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
