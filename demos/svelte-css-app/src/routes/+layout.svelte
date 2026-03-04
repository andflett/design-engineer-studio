<script>
  import "../app.css";
  let { children } = $props();
</script>

<header class="header">
  <nav class="nav">
    <a href="/" class="logo">SvelteKit CSS Demo</a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/about">About</a>
    </div>
  </nav>
</header>

<main class="main">
  {@render children()}
</main>

<footer class="footer">
  <p>SvelteKit + scoped styles + CSS variables — no Tailwind</p>
</footer>

<style>
  .header {
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
  }
  .nav {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--spacing-md) var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .logo {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-primary);
    text-decoration: none;
  }
  .nav-links {
    display: flex;
    gap: var(--spacing-lg);
  }
  .nav-links a {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .nav-links a:hover {
    color: var(--color-primary);
  }
  .main {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-lg);
  }
  .footer {
    border-top: 1px solid var(--color-border);
    margin-top: var(--spacing-2xl);
    padding: var(--spacing-md) var(--spacing-lg);
    text-align: center;
    font-size: 0.813rem;
    color: var(--color-text-muted);
  }
</style>
