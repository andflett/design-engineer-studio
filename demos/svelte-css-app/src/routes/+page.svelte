<script>
  import Card from "$lib/components/Card.svelte";
  import Button from "$lib/components/Button.svelte";
  import Badge from "$lib/components/Badge.svelte";

  let count = $state(0);
</script>

<section class="hero">
  <Badge text="No Tailwind" variant="accent" />
  <h1 class="hero-title">SvelteKit + Pure CSS</h1>
  <p class="hero-subtitle">
    Scoped component styles, global CSS variables, and zero utility frameworks.
    Every style is editable with Surface.
  </p>
</section>

<section class="section">
  <h2 class="section-title">Components with scoped styles</h2>
  <div class="grid-2">
    <Card title="CSS Variables" description="Global design tokens defined as custom properties in app.css. Edit them in the Surface token editor and every component updates." />
    <Card title="Scoped Styles" description="Each Svelte component has its own <style> block. Surface writes directly to the scoped CSS rules." />
  </div>
</section>

<section class="section">
  <h2 class="section-title">Interactive counter</h2>
  <div class="counter">
    <p class="counter-value">{count}</p>
    <div class="counter-actions">
      <Button onclick={() => count++}>Increment</Button>
      <Button onclick={() => count--} variant="secondary">Decrement</Button>
      <Button onclick={() => count = 0} variant="ghost">Reset</Button>
    </div>
  </div>
</section>

<section class="section">
  <h2 class="section-title">Feature grid</h2>
  <div class="grid-3">
    <div class="feature">
      <div class="feature-icon">&#9998;</div>
      <h3 class="feature-title">Visual editing</h3>
      <p class="feature-desc">Click any element to edit its styles in the property panel</p>
    </div>
    <div class="feature">
      <div class="feature-icon">&#9881;</div>
      <h3 class="feature-title">Token editing</h3>
      <p class="feature-desc">Edit CSS custom properties and see changes across the entire app</p>
    </div>
    <div class="feature">
      <div class="feature-icon">&#128196;</div>
      <h3 class="feature-title">Source writes</h3>
      <p class="feature-desc">Changes are written directly to your .svelte and .css files</p>
    </div>
  </div>
</section>

<style>
  .hero {
    text-align: center;
    padding: var(--spacing-2xl) 0;
  }
  .hero-title {
    font-size: 52px;
    font-weight: 800;
    color: var(--color-text);
    margin-top: var(--spacing-md);
    letter-spacing: -0.02em;
    padding: var(--spacing-xl);
}
  .hero-subtitle {
    font-size: 1.125rem;
    color: var(--color-text-muted);
    margin-top: var(--spacing-sm);
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.7;
  }
  .section {
    margin-top: var(--spacing-2xl);
  }
  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: var(--spacing-lg);
    color: var(--color-text);
  }
  .counter {
    text-align: center;
    padding: var(--spacing-xl);
    background: var(--color-bg-alt);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
  }
  .counter-value {
    font-size: 3rem;
    font-weight: 700;
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
  }
  .counter-actions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: center;
    margin-top: var(--spacing-md);
  }
  .feature {
    padding: var(--spacing-lg);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    text-align: center;
  }
  .feature-icon {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-sm);
  }
  .feature-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }
  .feature-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-top: var(--spacing-xs);
    line-height: 1.5;
  }
</style>
