import { useUnit } from "effector-react";
import { Trash2 } from "lucide-react";

import { type ListTypePath, type UserListMovie } from "@/shared/api";
import { Button } from "@/shared/ui";

import { PROFILE_TEXTS } from "../config";
import { $$listRemoval } from "../model";

export const RemoveButton = ({ list, movie }: { list: ListTypePath; movie: UserListMovie }) => {
  const { pending, removePressed } = useUnit({
    pending: $$listRemoval.outputs.$pending,
    removePressed: $$listRemoval.inputs.removePressed,
  });

  const isPending = pending.some((item) => item.list === list && item.movieId === movie.movie_id);

  return (
    <Button
      variant="brand-secondary-small"
      className="w-full px-2"
      aria-label={PROFILE_TEXTS.removeLabel(movie.title)}
      isDisabled={isPending}
      onPress={() => removePressed({ list, movieId: movie.movie_id })}
    >
      <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
      {PROFILE_TEXTS.remove}
    </Button>
  );
};
