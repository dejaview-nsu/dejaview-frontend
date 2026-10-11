import { render, screen } from "@testing-library/react";
import { allSettled, createEvent, createStore, fork, sample } from "effector";
import { Provider, useUnit } from "effector-react";
import { describe, expect, it } from "vitest";

import { createModelView } from "@/shared/lib/effector/model-view";

const createModel = () => {
  const changed = createEvent<string>();
  const $value = createStore("");

  sample({ clock: changed, target: $value });

  return { changed, $value };
};
const [modelView, useModel] = createModelView<ReturnType<typeof createModel>>();
const Child = () => {
  const model = useModel();
  const value = useUnit(model.$value);
  return <span>{value}</span>;
};
const View = modelView(({ label }: { label: string }) => (
  <section aria-label={label}>
    <Child />
  </section>
));

describe("model view", () => {
  it("provides independent instances to descendants and preserves the Effector scope", async () => {
    const first = createModel();
    const second = createModel();
    const scope = fork();
    await allSettled(first.changed, { scope, params: "Первый экземпляр" });
    await allSettled(second.changed, { scope, params: "Второй экземпляр" });
    render(
      <Provider value={scope}>
        <View $$model={first} label="Первая модель" />
        <View $$model={second} label="Вторая модель" />
      </Provider>,
    );
    expect(screen.getByRole("region", { name: "Первая модель" })).toHaveTextContent("Первый экземпляр");
    expect(screen.getByRole("region", { name: "Вторая модель" })).toHaveTextContent("Второй экземпляр");
  });
  it("reports a missing model provider", () => {
    expect(() => render(<Child />)).toThrow("Model view must wrap components that use its model.");
  });
});
