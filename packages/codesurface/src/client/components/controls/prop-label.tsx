export function PropLabel({
  label,
  inherited,
  noMargin,
}: {
  label: string;
  inherited?: boolean;
  noMargin?: boolean;
}) {
  return (
    <div
      className={`text-[10px] font-medium ${noMargin ? "" : "mb-1.5"}`}
      style={{
        color: "var(--studio-text-dimmed)",
        letterSpacing: "0.03em",
      }}
    >
      {label}
      {inherited && (
        <span
          className="ml-1 text-[10px] italic"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          inherited
        </span>
      )}
    </div>
  );
}

export function SubSectionLabel({ label }: { label: string }) {
  return (
    <div
      className="text-[10px] font-medium tracking-wide mt-1 mb-1"
      style={{ color: "var(--studio-text-muted)" }}
    >
      {label}
    </div>
  );
}
