<script>
  let { title, description } = $props();
</script>

<div class="card">
  <h3 class="card-title">{title}</h3>
  <p class="card-body">{description}</p>
</div>

<style>
  .card {
    padding: 1.5rem;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    background: white;
  }
  .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text);
  }
  .card-body {
    margin-top: 0.5rem;
    color: var(--color-muted);
    line-height: 1.6;
  }
</style>
