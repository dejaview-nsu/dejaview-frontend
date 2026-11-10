import { Check, ChevronDown } from "lucide-react";
import { Select as AriaSelect, Button, Label, ListBox, ListBoxItem, Popover, SelectValue } from "react-aria-components";

export const Select = <Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) => (
  <AriaSelect
    selectedKey={value}
    onSelectionChange={(key) => {
      const option = options.find((option) => option.value === key);

      if (option) onChange(option.value);
    }}
    className="flex w-full flex-wrap items-center gap-3 font-body sm:w-auto"
  >
    <Label className="text-sm text-muted">{label}</Label>
    <Button className="flex h-12 w-full cursor-pointer items-center justify-between gap-4 rounded-none border-2 border-border-strong bg-card px-3 text-base text-ink outline-link hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto">
      <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
      <ChevronDown size={20} aria-hidden="true" />
    </Button>
    <Popover
      placement="bottom end"
      offset={4}
      className="z-50 min-w-(--trigger-width) border-2 border-border-strong bg-card font-body text-base text-ink shadow-hard"
    >
      <ListBox className="outline-none">
        {options.map(({ value, label }) => (
          <ListBoxItem
            key={value}
            id={value}
            textValue={label}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-3 py-2 outline-none data-[focused]:bg-hover data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-link"
          >
            {({ isSelected }) => (
              <>
                {label}
                <Check size={20} aria-hidden="true" className={isSelected ? "shrink-0" : "invisible shrink-0"} />
              </>
            )}
          </ListBoxItem>
        ))}
      </ListBox>
    </Popover>
  </AriaSelect>
);
