<script>
  import Card from "$lib/components/Card.svelte";
</script>

<h1 class="title">About this demo</h1>
<p class="intro">
  This SvelteKit app uses only scoped component styles and global CSS custom properties.
  No Tailwind CSS, no utility framework — just plain CSS the way Svelte was designed to use it.
</p>

<div class="grid-2">
  <Card
    title="Scoped <style> blocks"
    description="Each .svelte file has its own <style> block. Svelte scopes these styles to the component automatically, preventing conflicts."
  />
  <Card
    title="Global CSS variables"
    description="Design tokens are defined as CSS custom properties in app.css. Components reference them via var() for consistent theming."
  />
</div>

<style>
  .title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text);
  }
  .intro {
    font-size: 1.0625rem;
    color: var(--color-text-muted);
    margin-top: var(--spacing-sm);
    margin-bottom: var(--spacing-xl);
    max-width: 640px;
    line-height: 1.7;
  }
</style>
