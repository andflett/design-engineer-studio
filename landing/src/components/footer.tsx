export function Footer() {
  return (
    <footer className="py-8 border-t border-edge-subtle">
      <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        <span className="text-[12px] text-ink3 font-mono"><span className="text-ink3/50">@designtools/</span>surface</span>
        <ul className="flex gap-5 list-none">
          <li>
            <a href="https://github.com/AJFletcher/designtools" target="_blank" rel="noopener" className="text-[12px] text-ink3 hover:text-ink2 transition-colors font-mono">
              github
            </a>
          </li>
          <li>
            <a href="https://www.npmjs.com/package/@designtools/surface" target="_blank" rel="noopener" className="text-[12px] text-ink3 hover:text-ink2 transition-colors font-mono">
              npm
            </a>
          </li>
          <li>
            <a href="https://www.flett.cc/projects/design-engineer-studio" target="_blank" rel="noopener" className="text-[12px] text-ink3 hover:text-ink2 transition-colors font-mono">
              about
            </a>
          </li>
          <li>
            <a href="#privacy" className="text-[12px] text-ink3 hover:text-ink2 transition-colors font-mono">
              privacy
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
