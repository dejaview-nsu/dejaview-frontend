import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fileConstraints } from "@/features/search-by-file";
import { videoConstraints } from "@/features/search-by-video";

import { FilePickerButton, FileUpload } from "@/shared/ui/file-upload";

import { userEventSetup } from "../../test-utils";

const file = () => new File(["image"], "frame.png", { type: "image/png" });

describe("shared file upload", () => {
  it("chooses and replaces a single file, resets input to allow selecting same file twice", async () => {
    const selected = vi.fn();
    render(
      <FileUpload constraints={fileConstraints.image} files={[]} onFilesSelected={selected} onRemove={() => {}} />,
    );
    const input = screen.getByLabelText("Выберите изображение") as HTMLInputElement;
    const image = file();
    const user = userEventSetup();
    await user.upload(input, image);
    await user.upload(input, image);
    expect(selected.mock.calls).toEqual([[[image]], [[image]]]);
    expect(input.multiple).toBe(false);
  });
  it("reports all dropped files so model can reject multiple files", () => {
    const selected = vi.fn();
    render(<FileUpload constraints={videoConstraints} files={[]} onFilesSelected={selected} onRemove={() => {}} />);
    const files = [file(), file()];
    fireEvent.drop(screen.getByRole("group"), { dataTransfer: { files } });
    expect(selected).toHaveBeenCalledWith(files);
  });
  it("pastes only in image mode and removes listener on unmount", () => {
    const selected = vi.fn();
    const { unmount } = render(
      <FileUpload
        constraints={fileConstraints.image}
        files={[]}
        allowPaste
        onFilesSelected={selected}
        onRemove={() => {}}
      />,
    );
    fireEvent.paste(document, { clipboardData: { files: [file()] } });
    expect(selected).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.paste(document, { clipboardData: { files: [file()] } });
    expect(selected).toHaveBeenCalledTimes(1);
  });
  it("ignores paste in video mode and all selection when disabled", () => {
    const selected = vi.fn();
    render(
      <FileUpload
        constraints={videoConstraints}
        files={[]}
        isDisabled
        onFilesSelected={selected}
        onRemove={() => {}}
      />,
    );
    fireEvent.paste(document, { clipboardData: { files: [file()] } });
    fireEvent.drop(screen.getByRole("group"), { dataTransfer: { files: [file()] } });
    expect(selected).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Выбрать файл" })).toBeDisabled();
  });
  it("displays filename and provides remove action", async () => {
    const remove = vi.fn();
    render(
      <FileUpload constraints={fileConstraints.image} files={[file()]} onFilesSelected={() => {}} onRemove={remove} />,
    );
    expect(screen.getByText(/frame.png/)).toBeInTheDocument();
    await userEventSetup().click(screen.getByRole("button", { name: "Удалить файл" }));
    expect(remove).toHaveBeenCalledOnce();
  });
});

describe("shared file upload mode parameters", () => {
  it("uses passed prompt and hint instead of the default texts", () => {
    render(
      <FileUpload
        appearance="brand"
        constraints={videoConstraints}
        files={[]}
        prompt="Свой текст зоны"
        hint="Свои ограничения"
        onFilesSelected={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("Свой текст зоны")).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAccessibleDescription("Свои ограничения");
    expect(screen.queryByText(/Перетащи/)).not.toBeInTheDocument();
  });

  it("renders a custom selection that reopens the picker and still accepts dropped replacements", async () => {
    const selected = vi.fn();
    const opened = vi.fn();
    const video = new File(["video"], "scene.mp4", { type: "video/mp4" });
    render(
      <FileUpload
        constraints={videoConstraints}
        files={[video]}
        renderSelected={(files, openPicker) => (
          <button type="button" onClick={openPicker}>
            Своя карточка {files[0].name}
          </button>
        )}
        onFilesSelected={selected}
        onRemove={() => {}}
      />,
    );
    screen.getByLabelText("Выберите видеофрагмент").addEventListener("click", opened);
    expect(screen.queryByRole("button", { name: "Заменить файл" })).not.toBeInTheDocument();
    await userEventSetup().click(screen.getByRole("button", { name: "Своя карточка scene.mp4" }));
    expect(opened).toHaveBeenCalledOnce();
    const replacement = new File(["other"], "other.mp4", { type: "video/mp4" });
    fireEvent.drop(screen.getByRole("group"), { dataTransfer: { files: [replacement] } });
    expect(selected).toHaveBeenCalledWith([replacement]);
  });

  it("leaves the input without an id when none is passed", () => {
    render(<FileUpload constraints={videoConstraints} files={[]} onFilesSelected={() => {}} onRemove={() => {}} />);
    expect(screen.getByLabelText("Выберите видеофрагмент")).not.toHaveAttribute("id");
  });

  it("opens the picker from an outside label bound by the input id with a click and from the keyboard", async () => {
    const opened = vi.fn();
    render(
      <>
        <FileUpload
          constraints={videoConstraints}
          files={[]}
          inputId="video-file"
          onFilesSelected={() => {}}
          onRemove={() => {}}
        />
        <FilePickerButton inputId="video-file" variant="brand-secondary">
          Выбрать другой файл
        </FilePickerButton>
      </>,
    );
    const input = screen.getByLabelText("Выберите видеофрагмент");
    const button = screen.getByRole("button", { name: "Выбрать другой файл" });
    expect(input).toHaveAttribute("id", "video-file");
    expect(button).toHaveAttribute("for", "video-file");
    input.addEventListener("click", opened);
    const user = userEventSetup();
    await user.click(button);
    expect(opened).toHaveBeenCalledOnce();
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(opened).toHaveBeenCalledTimes(3);
  });
});
