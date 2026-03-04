<script>
  let { text, variant = "default" } = $props();
</script>

<span class="badge badge-{variant}">{text}</span>

<style>
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .badge-default {
    background: var(--color-bg-alt);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }
  .badge-accent {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
</style>
