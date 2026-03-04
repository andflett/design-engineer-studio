<script>
  let { title, description } = $props();
</script>

<div class="card">
  <h3 class="card-title">{title}</h3>
  <p class="card-body">{description}</p>
</div>

<style>
  .card {
    padding: var(--spacing-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.15s;
  }
  .card:hover {
    box-shadow: var(--shadow-md);
  }
  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }
  .card-body {
    margin-top: var(--spacing-sm);
    color: var(--color-text-muted);
    font-size: 0.875rem;
    line-height: 1.6;
  }
</style>
