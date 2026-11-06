import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Select } from "@/shared/ui";

import { userEventSetup } from "../../test-utils";

const Example = () => {
  const [value, setValue] = useState("best");

  return (
    <Select
      label="Сортировать по:"
      value={value}
      onChange={setValue}
      options={[
        { value: "best", label: "Сначала лучшие" },
        { value: "worst", label: "Сначала худшие" },
      ]}
    />
  );
};

describe("select", () => {
  it("supports keyboard selection, exposes the selected option and restores focus", async () => {
    const user = userEventSetup();
    render(<Example />);
    const button = screen.getByRole("button", { name: /Сортировать по:/ });

    await user.tab();
    await waitFor(() => expect(button).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(screen.getByRole("option", { name: "Сначала лучшие" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(button).toHaveTextContent("Сначала худшие");
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() => expect(button).toHaveFocus());

    await user.keyboard("{Enter}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() => expect(button).toHaveFocus());
    expect(button).toHaveTextContent("Сначала худшие");
  });
});
