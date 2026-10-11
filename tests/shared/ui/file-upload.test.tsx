import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fileConstraints } from "@/features/search-by-file";

import { FileUpload } from "@/shared/ui/file-upload";

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
    render(
      <FileUpload constraints={fileConstraints.video} files={[]} onFilesSelected={selected} onRemove={() => {}} />,
    );
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
        constraints={fileConstraints.video}
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
