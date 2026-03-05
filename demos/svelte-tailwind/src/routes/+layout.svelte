<script>
  import "../app.css";
  let { children } = $props();
</script>

<header>
  <nav class="flex items-center gap-4 px-6 py-4 border-b border-gray-200">
    <a href="/" class="text-lg font-semibold text-indigo-600">SvelteKit Demo</a>
  </nav>
</header>

<main class="max-w-4xl mx-auto px-6 py-8">
  {@render children()}
</main>

<footer class="border-t border-gray-200 mt-12 px-6 py-4 text-sm text-gray-500">
  <p>SvelteKit + designtools demo</p>
</footer>
