<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { Heart, Loader2, ListChecks, ArrowUp } from 'lucide-svelte';

  let currentYear = new Date().getFullYear();
  let latestVersion = null;
  let loadingVersion = true;
  let showGoTop = false;

  // Gestion du scroll pour le bouton "Haut de page"
  function handleScroll() {
    showGoTop = window.scrollY > 200;
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onMount(async () => {
    // Récupérer la dernière version du changelog
    const { data } = await supabase
      .from('changelog')
      .select('title, type')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (data) {
      const typeText = data.type === 'Nouveau' ? '[Nouveau]' : (data.type === 'Corrigé' ? '[Fix]' : '[MàJ]');
      latestVersion = `${typeText} ${data.title}`;
    } else {
      latestVersion = 'v1.0.0';
    }
    loadingVersion = false;
  });
</script>

<svelte:window on:scroll={handleScroll} />

<footer class="bg-gray-900 text-gray-400 text-sm py-6 mt-16 border-t border-gray-700">
  <div class="container mx-auto px-6 text-center font-semibold">
    <p class="flex items-center justify-center gap-2 flex-wrap">
      <span>BACO</span>
      <span class="text-gray-600">&bull;</span>
      <span class="flex items-center gap-1">
       Made with <Heart class="w-4 h-4 inline-block text-red-500 fill-current" />
      </span>
      <span class="text-gray-600">&bull;</span>
      
      <span>{currentYear}</span>
      
      <span class="text-gray-600">&bull;</span>
      <a href="/changelog" 
         class="flex items-center gap-1 text-gray-500 hover:text-blue-400 transition-colors"
         title="Voir l'historique des modifications">
        {#if loadingVersion}
          <Loader2 class="w-4 h-4 animate-spin" />
          <span>Chargement...</span>
        {:else}
          <ListChecks class="w-4 h-4" />
          <span>{latestVersion}</span>
        {/if}
      </a>
      <span class="text-gray-600 hidden md:inline">&bull;</span>
      <span>Nicolas Dessenius & Thomas Buet</span>
    </p>
  </div>

  <button
    on:click={scrollToTop}
    class="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 {showGoTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}"
    title="Retour en haut"
  >
    <ArrowUp class="w-5 h-5" />
  </button>
</footer>