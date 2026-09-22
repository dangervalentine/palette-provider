import * as RadixSelect from "@radix-ui/react-select";

const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
    <path
      d="M4 6l4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Check = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
    <path
      d="M3 8.5l3 3 7-7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Select = ({ value, onValueChange, options, disabled, label }) => (
  <RadixSelect.Root
    value={value}
    onValueChange={onValueChange}
    disabled={disabled}
  >
    <RadixSelect.Trigger className="select-trigger" aria-label={label}>
      <RadixSelect.Value />
      <RadixSelect.Icon className="select-icon">
        <Chevron />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content
        className="select-content"
        position="popper"
        sideOffset={4}
      >
        <RadixSelect.Viewport className="select-viewport">
          {options.map((opt) => (
            <RadixSelect.Item
              key={opt.value}
              value={opt.value}
              className="select-item"
            >
              <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
              <RadixSelect.ItemIndicator className="select-indicator">
                <Check />
              </RadixSelect.ItemIndicator>
            </RadixSelect.Item>
          ))}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>
);

export default Select;
