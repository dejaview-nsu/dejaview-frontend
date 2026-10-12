import { type ComponentType, createContext, useContext } from "react";

export const createModelView = <Model,>() => {
  const Context = createContext<Model | null>(null);

  const useModel = (): Model => {
    const model = useContext(Context);
    if (model === null) throw new Error("Model view must wrap components that use its model.");
    return model;
  };

  const modelView = <Props extends object>(View: ComponentType<Props>) => {
    return ({ $$model, ...props }: Props & { $$model: Model }) => (
      <Context.Provider value={$$model}>
        <View {...(props as Props)} />
      </Context.Provider>
    );
  };

  return [modelView, useModel] as const;
};
