import { useUnit } from "effector-react";

import { Button } from "@/shared/ui/button";

import { $$login } from "../model";

const StubLoginButton = () => {
  const stubLogin = useUnit($$login.inputs.stubLoginPressed);

  return (
    <div>
      <Button onPress={() => stubLogin()}>Войти (заглушка)</Button>
    </div>
  );
};

export const LoginPage = () => (
  <section className="flex flex-col gap-4">
    <h1 className="text-2xl font-semibold">Вход</h1>
    {import.meta.env.DEV && <StubLoginButton />}
  </section>
);
