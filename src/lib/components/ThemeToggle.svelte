<script>
  import { theme } from '$lib/stores/theme';
  import { Sun, Moon } from 'lucide-svelte';

  function toggle() {
    $theme = $theme === 'dark' ? 'light' : 'dark';
  }
</script>

<button 
  on:click={toggle} 
  class="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
  title="Changer le thème"
>
  {#if $theme === 'dark'}
    <Sun class="w-5 h-5" />
  {:else}
    <Moon class="w-5 h-5" />
  {/if}
</button>