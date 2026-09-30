import { useUnit } from "effector-react";

import { Button } from "@/shared/ui/button";

import { $$login } from "../model";

export const LoginPage = () => {
  const stubLogin = useUnit($$login.inputs.stubLoginPressed);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Вход</h1>
      <div>
        <Button onPress={() => stubLogin()}>Войти</Button>
      </div>
    </section>
  );
};
