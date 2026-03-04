<script>
  let { onclick, children, variant = "primary" } = $props();
</script>

<button class="btn btn-{variant}" onclick={onclick}>
  {@render children()}
</button>

<style>
  .btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-sm);
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s, color 0.15s;
  }
  .btn-primary {
    background: var(--color-primary);
    color: white;
  }
  .btn-primary:hover {
    background: var(--color-primary-hover);
  }
  .btn-secondary {
    background: var(--color-bg-alt);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .btn-secondary:hover {
    background: var(--color-border);
  }
  .btn-ghost {
    background: transparent;
    color: var(--color-text-muted);
  }
  .btn-ghost:hover {
    background: var(--color-bg-alt);
    color: var(--color-text);
  }
</style>
