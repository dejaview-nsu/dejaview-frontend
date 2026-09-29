import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/shared/ui/button";

import { userEventSetup } from "../../test-utils";

describe("Button", () => {
  it("renders children as accessible button", () => {
    render(<Button>Нажми меня</Button>);

    expect(screen.getByRole("button", { name: "Нажми меня" })).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<Button variant="secondary">Вторичная</Button>);

    expect(screen.getByRole("button")).toHaveClass("border");
  });

  it("supports RAC isDisabled", () => {
    render(<Button isDisabled>Недоступна</Button>);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("handles onPress", async () => {
    const onPress = vi.fn();
    const user = userEventSetup();

    render(<Button onPress={onPress}>Клик</Button>);
    await user.click(screen.getByRole("button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
