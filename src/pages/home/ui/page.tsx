import { useUnit } from "effector-react";

import { Button } from "@/shared/ui/button";

import { $$home } from "../model";

export const HomePage = () => {
  const { post, error, pending, refresh } = useUnit({
    post: $$home.outputs.$post,
    error: $$home.outputs.$error,
    pending: $$home.outputs.$pending,
    refresh: $$home.inputs.refreshRequested,
  });

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Не удалось загрузить данные</h1>
        <p className="text-text-caption">Проверьте подключение и попробуйте снова.</p>
        <div>
          <Button isDisabled={pending} onPress={refresh}>
            Повторить
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{post?.title}</h1>
      <p className="whitespace-pre-line text-text-caption">{post?.body}</p>
    </section>
  );
};
