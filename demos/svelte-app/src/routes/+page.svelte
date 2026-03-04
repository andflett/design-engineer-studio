<script>
  import Card from "$lib/components/Card.svelte";
  import Button from "$lib/components/Button.svelte";

  let count = $state(0);
</script>

<section class="hero">
  <h1 class="hero-title">Welcome to SvelteKit</h1>
  <p class="hero-subtitle">A designtools demo with scoped styles and Tailwind CSS</p>
</section>

<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
  <Card title="Scoped Styles" description="This card uses scoped CSS in its <style> block." />
  <Card title="Tailwind CSS" description="The layout uses Tailwind utility classes." />
</div>

<div class="counter mt-8">
  <h2 class="counter-label">Counter: {count}</h2>
  <div class="flex gap-3">
    <Button onclick={() => count++}>Increment</Button>
    <Button onclick={() => count = 0} variant="secondary">Reset</Button>
  </div>
</div>

<style>
  .hero {
    text-align: center;
    padding: 2rem 0;
  }
  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--color-primary);
  }
  .hero-subtitle {
    font-size: 1.125rem;
    color: var(--color-muted);
    margin-top: 0.5rem;
  }
  .counter {
    text-align: center;
    padding: 2rem;
    background: #f8fafc;
    border-radius: 0.75rem;
  }
  .counter-label {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
</style>
