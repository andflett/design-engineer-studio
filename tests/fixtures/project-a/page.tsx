export default function Page() {
  return (
    <div className="p-4 flex">
      <h1 className="text-lg font-bold">Hello</h1>
      <span className={cn("text-sm", variant)}>World</span>
    </div>
  );
}
