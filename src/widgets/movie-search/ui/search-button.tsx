import { LoaderCircle, Search } from "lucide-react";

import { Button } from "@/shared/ui/button";

export const SearchButton = ({
  pending,
  pendingLabel = "Ищем…",
  isDisabled,
  onPress,
}: {
  pending: boolean;
  pendingLabel?: string;
  isDisabled?: boolean;
  onPress: () => void;
}) => (
  <Button
    variant={pending ? "brand-loading" : "brand"}
    className="h-[52px] w-full md:h-12 md:w-auto"
    isDisabled={pending || isDisabled}
    aria-label={pending ? "Поиск выполняется" : "Начать поиск"}
    onPress={onPress}
  >
    {pending ? (
      <LoaderCircle size={20} strokeWidth={1.75} className="motion-safe:animate-spin" aria-hidden="true" />
    ) : (
      <Search size={20} strokeWidth={1.75} aria-hidden="true" />
    )}
    {pending ? pendingLabel : "Начать поиск"}
  </Button>
);
