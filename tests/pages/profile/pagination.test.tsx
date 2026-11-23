import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pageItems } from "@/pages/profile/lib/pagination";
import { ListPagination } from "@/pages/profile/ui/list-pagination";

import { userEventSetup } from "../../test-utils";

const numbers = (page: number, total: number, compact: boolean) =>
  pageItems(page, total, compact)
    .filter(({ skipped }) => !skipped)
    .map(({ from }) => from);

describe("profile pagination", () => {
  it("deduplicates overlapping desktop ranges and includes the current page", () => {
    expect(numbers(6, 9, false)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(numbers(50, 100, false)).toEqual([1, 2, 3, 4, 5, 50, 96, 97, 98, 99, 100]);
  });

  it.each([50, 100])("keeps both mobile boundaries and the middle compact for %i pages", (total) => {
    expect(numbers(1, total, true)).toEqual([1, 2, total]);
    expect(numbers(25, total, true)).toEqual([24, 25, 26]);
    expect(numbers(total, total, true)).toEqual([1, total - 1, total]);
    expect(pageItems(25, total, true)).toHaveLength(5);
  });

  it("shows the active page, handles arrows and numbers, and accepts a page from a gap", async () => {
    const user = userEventSetup();
    const select = vi.fn();
    const { rerender } = render(<ListPagination page={1} total={100} onSelect={select} />);
    const navigation = screen.getByRole("navigation", { name: "Страницы списка" });
    const mobile = within(navigation.children[1] as HTMLElement);

    expect(mobile.getByRole("button", { name: "Назад" })).toBeDisabled();
    expect(mobile.getByRole("button", { name: "Страница 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Страница 1 из 100")).toBeInTheDocument();

    await user.click(mobile.getByRole("button", { name: "Вперёд" }));
    expect(select).toHaveBeenLastCalledWith(2);
    await user.click(mobile.getByRole("button", { name: "Страница 100" }));
    expect(select).toHaveBeenLastCalledWith(100);
    await user.click(mobile.getByRole("button", { name: "Страницы 3–99" }));
    await user.type(mobile.getByRole("spinbutton"), "50{Enter}");
    expect(select).toHaveBeenLastCalledWith(50);

    rerender(<ListPagination page={100} total={100} onSelect={select} />);
    expect(screen.getByText("Страница 100 из 100")).toBeInTheDocument();
    expect(mobile.getByRole("button", { name: "Вперёд" })).toBeDisabled();
    await user.click(mobile.getByRole("button", { name: "Назад" }));
    expect(select).toHaveBeenLastCalledWith(99);
  });

  it("updates an open gap when pages disappear and closes it when the gap is gone", async () => {
    const user = userEventSetup();
    const select = vi.fn();
    const { rerender } = render(<ListPagination page={1} total={100} onSelect={select} />);
    const mobile = within(screen.getByRole("navigation").children[1] as HTMLElement);

    await user.click(mobile.getByRole("button", { name: "Страницы 3–99" }));
    const pageInput = mobile.getByRole("spinbutton", { name: "Страница 3–99" });
    await user.type(pageInput, "75");

    rerender(<ListPagination page={1} total={50} onSelect={select} />);
    expect(mobile.getByRole("spinbutton", { name: "Страница 3–49" })).toHaveAttribute("max", "49");
    await user.keyboard("{Enter}");
    expect(select).not.toHaveBeenCalled();

    await user.clear(pageInput);
    await user.type(pageInput, "49{Enter}");
    expect(select).toHaveBeenCalledExactlyOnceWith(49);

    await user.click(mobile.getByRole("button", { name: "Страницы 3–49" }));
    rerender(<ListPagination page={1} total={3} onSelect={select} />);
    expect(mobile.queryByRole("spinbutton")).not.toBeInTheDocument();
    rerender(<ListPagination page={1} total={50} onSelect={select} />);
    expect(mobile.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
