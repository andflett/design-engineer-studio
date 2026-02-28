import * as Select from "@radix-ui/react-select";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";
import { Tooltip } from "../tooltip.js";

export interface SelectOption {
  value: string;
  label?: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface StudioSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  className?: string;
  /** Icon rendered in left gutter — wraps select in a bordered container */
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  /** Tooltip shown on icon hover */
  tooltip?: string;
}

export function StudioSelect({
  value,
  onChange,
  options,
  groups,
  placeholder,
  className,
  icon: Icon,
  tooltip,
}: StudioSelectProps) {
  const trigger = (
    <Select.Trigger
      className={Icon ? "studio-select" : (className || "studio-select")}
      asChild={false}
    >
      <span className="studio-prop-select-value">
        <Select.Value placeholder={placeholder} />
      </span>
      <Select.Icon asChild>
        <ChevronDownIcon style={{ width: 10, height: 10, flexShrink: 0 }} />
      </Select.Icon>
    </Select.Trigger>
  );

  const content = (
    <Select.Portal>
      <Select.Content
        className="studio-prop-select-content"
        position="popper"
        sideOffset={4}
        collisionPadding={12}
      >
        <Select.Viewport>
          {options?.map((opt) => (
            <StudioSelectItem key={opt.value} value={opt.value}>
              {opt.label ?? opt.value}
            </StudioSelectItem>
          ))}

          {groups?.map((group, i) => (
            <Select.Group key={group.label}>
              {(i > 0 || (options && options.length > 0)) && (
                <Select.Separator className="studio-prop-select-separator" />
              )}
              <Select.Label className="studio-prop-select-group-label">
                {group.label}
              </Select.Label>
              {group.options.map((opt) => (
                <StudioSelectItem key={opt.value} value={opt.value}>
                  {opt.label ?? opt.value}
                </StudioSelectItem>
              ))}
            </Select.Group>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  );

  if (Icon) {
    return (
      <div className="studio-scrub-input" style={{ gap: 0 }}>
        <Tooltip content={tooltip || ""} side="left">
          <div className="studio-scrub-icon no-scrub">
            <Icon style={{ width: 12, height: 12 }} />
          </div>
        </Tooltip>
        <Select.Root value={value} onValueChange={onChange}>
          {trigger}
          {content}
        </Select.Root>
      </div>
    );
  }

  return (
    <Select.Root value={value} onValueChange={onChange}>
      {trigger}
      {content}
    </Select.Root>
  );
}

function StudioSelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Select.Item value={value} className="studio-prop-select-item">
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="studio-prop-select-check">
        <CheckIcon style={{ width: 10, height: 10 }} />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
