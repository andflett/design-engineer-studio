<script>
  let { onclick, children, variant = "primary" } = $props();
</script>

<button class="btn btn-{variant}" onclick={onclick}>
  {@render children()}
</button>

<style>
  .btn {
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    border: none;
    transition: background 0.15s;
  }
  .btn-primary {
    background: var(--color-primary);
    color: white;
  }
  .btn-primary:hover {
    background: var(--color-primary-light);
  }
  .btn-secondary {
    background: var(--color-border);
    color: var(--color-text);
  }
  .btn-secondary:hover {
    background: #cbd5e1;
  }
</style>
