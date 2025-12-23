<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  
  // --- IMPORTS COMPOSANTS ---
  import Nav from '$lib/components/Nav.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import GlobalSearch from '$lib/components/GlobalSearch.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  
  // --- UTILS ---
  import DashboardSkeleton from '$lib/components/DashboardSkeleton.svelte';
  import { zenMode } from '$lib/stores/zen';
  import { toast } from '$lib/stores/toast.js'; 
  import { Minimize } from 'lucide-svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicIn, cubicOut } from 'svelte/easing';

  // --- VARIABLES ---
  let user = null;
  let loading = true; 
  let isChristmasTheme = false;
  let isScreenshotFlashing = false; // Pour le flou flash lors du screenshot

  $: isLoginPage = $page.url.pathname === '/';

  // --- LOGIQUE CLAVIER ---
  function handleKeydown(event) {
    // Quitter le mode Zen avec Echap
    if (event.key === 'Escape' && $zenMode) {
        zenMode.set(false);
    }
  }

  onMount(async () => {
    // --- 1. LOGIQUE DE FLOU FLASH (SCREENSHOT) ---
    const handlePrintScreen = async (e) => {
      // Détection de la touche PrintScreen (Code 44 ou nom de touche)
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        // Activer le flou immédiatement
        isScreenshotFlashing = true;
        
        toast.warning("Capture d'écran : Les données sensibles ont été floutées par sécurité.");

        // Tenter de vider le presse-papier pour écraser l'image capturée (si supporté)
        try {
          await navigator.clipboard.writeText("Contenu protégé - BACO");
        } catch (err) {}

        // Retirer le flou après 1 seconde (laisse le temps au système de finir la capture)
        setTimeout(() => {
          isScreenshotFlashing = false;
        }, 1000); 
      }
    };

    // On écoute le KEYDOWN pour flouter AVANT que le système ne capture au KEYUP
    window.addEventListener('keydown', handlePrintScreen);

    // --- 2. AUTHENTICATION & SESSION ---
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;

    // Redirections de sécurité
    if (!user && !isLoginPage) {
        goto('/');
    } else if (user && isLoginPage) {
        goto('/accueil');
    }

    // Récupération thème Noël
    if (typeof localStorage !== 'undefined') {
      isChristmasTheme = localStorage.getItem('bacoChristmasTheme') !== 'false';
    }
    
    loading = false;

    // Écouteur de changement d'état Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      user = session?.user;
      if (event === 'SIGNED_OUT') goto('/');
    });

    // --- 3. NETTOYAGE DES ÉCOUTEURS ---
    return () => {
      window.removeEventListener('keydown', handlePrintScreen);
      subscription.unsubscribe();
    };
  });
</script>

<svelte:window on:keydown={handleKeydown} />

{#if loading && !isLoginPage}
  <DashboardSkeleton />
{:else}
  <div class="min-h-screen flex flex-col bg-deep-space text-gray-900 dark:text-gray-100 transition-all duration-300 relative {isScreenshotFlashing ? 'blur-3xl scale-95 pointer-events-none' : ''}">
    
    {#if !isLoginPage && !$zenMode}
      <div transition:fade={{ duration: 200 }}>
          <Nav {user} />
          <GlobalSearch />
      </div>
    {/if}

    {#if user}
      <div class="fixed inset-0 pointer-events-none z-[9999] opacity-[0.015] flex flex-wrap gap-20 overflow-hidden select-none">
        {#each Array(20) as _}
          <span class="text-white text-xl font-bold rotate-[-45deg] whitespace-nowrap">
            {user.email} - {new Date().toLocaleString()}
          </span>
        {/each}
      </div>
    {/if}

    <main class="flex-grow grid grid-cols-1 grid-rows-1 {isLoginPage ? '' : ($zenMode ? 'h-screen overflow-hidden' : 'container mx-auto px-4 py-8')}">
      {#key $page.url.pathname}
        <div 
          class="col-start-1 row-start-1 w-full h-full"
          in:fly={{ y: 20, duration: 300, delay: 300, easing: cubicOut }} 
          out:fly={{ y: -20, duration: 300, easing: cubicIn }}
        >
          <slot />
        </div>
      {/key}
    </main>

    {#if !isLoginPage && !$zenMode}
      <div transition:fade={{ duration: 200 }}>
          <Footer />
      </div> 
    {/if}

    {#if $zenMode}
      <button 
          on:click={() => zenMode.set(false)}
          transition:fade
          class="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-white border border-white/5 backdrop-blur-md shadow-2xl transition-all hover:scale-110 group"
          title="Quitter le mode Zen (Échap)"
      >
          <Minimize class="w-6 h-6" />
      </button>
    {/if}

    <ToastContainer />
    <ConfirmModal />
  </div>
{/if}

<style>
  /* Interdiction absolue d'imprimer la page */
  @media print {
    :global(body) { display: none !important; }
  }
</style>