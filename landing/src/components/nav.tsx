const GitHubIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const NpmIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 256 256" fill="currentColor">
    <path d="M0 256V0h256v256H0zm41-41h43.7v-131H128v131h87V41H41v174z" />
  </svg>
);

export function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-3 bg-ink/90 backdrop-blur-xl border-b border-white/8">
      <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        <a href="#" className="flex items-center text-[13px] text-white font-mono">
          <span className="text-white/40">@designtools/</span>surface
        </a>

        <div className="flex items-center gap-6">
          <a
            href="https://github.com/andflett/designtools"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center text-white/50 hover:text-white transition-colors"
            title="GitHub"
          >
            <GitHubIcon />
          </a>
          <a
            href="https://www.npmjs.com/package/@designtools/surface"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center text-white/50 hover:text-white transition-colors"
            title="npm"
          >
            <NpmIcon />
          </a>
        </div>
      </div>
    </nav>
  );
}
