<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { toast } from '$lib/stores/toast.js';
  import { zenMode } from '$lib/stores/zen';
  
  // ... vos autres imports (Nav, Footer, etc.)

  let user = null;
  let loading = true;
  let isScreenshotFlashing = false; // Nouvel état pour le flash de flou

  $: isLoginPage = $page.url.pathname === '/';

  onMount(async () => {
    // --- LOGIQUE DE FLOU SPÉCIFIQUE AU SCREENSHOT ---
    const handlePrintScreen = async (e) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        // Activer le flou immédiatement
        isScreenshotFlashing = true;
        
        toast.warning("Capture d'écran : Les données ont été floutées par sécurité.");

        // Tenter de vider le presse-papier
        try {
          await navigator.clipboard.writeText("Contenu protégé");
        } catch (err) {}

        // Retirer le flou après un court instant (le temps que le système prenne la capture)
        setTimeout(() => {
          isScreenshotFlashing = false;
        }, 1000); 
      }
    };

    window.addEventListener('keyup', handlePrintScreen);

    // --- AUTHENTIFICATION ---
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;
    loading = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      user = session?.user;
      if (event === 'SIGNED_OUT') goto('/');
    });

    return () => {
      window.removeEventListener('keyup', handlePrintScreen);
      subscription.unsubscribe();
    };
  });
</script>

<div class="min-h-screen flex flex-col transition-all duration-300 {isScreenshotFlashing ? 'blur-3xl' : ''}">
  {#if loading && !isLoginPage}
    {:else}
    {#if user}
      <div class="fixed inset-0 pointer-events-none z-[9999] opacity-[0.03] flex flex-wrap gap-20 overflow-hidden select-none">
        {#each Array(20) as _}
          <span class="text-white text-xl font-bold rotate-[-45deg] whitespace-nowrap">
            {user.email} - {new Date().toLocaleString()}
          </span>
        {/each}
      </div>
    {/if}

    <slot />
  {/if}
</div>

<style>
  /* On garde l'interdiction d'impression qui est infaillible */
  @media print {
    :global(body) { display: none !important; }
  }
</style>