<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { zenMode } from '$lib/stores/zen'; // Import du store
  import { Minimize } from 'lucide-svelte';  // Icône pour sortir
  // Import des transitions Svelte
  import { fly, fade } from 'svelte/transition';
  import { cubicIn, cubicOut } from 'svelte/easing';
import DashboardSkeleton from '$lib/components/DashboardSkeleton.svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import Nav from '$lib/components/Nav.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import GlobalSearch from '$lib/components/GlobalSearch.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  let user = null;
  let loading = true;
  let isChristmasTheme = false;

  $: isLoginPage = $page.url.pathname === '/';

  onMount(async () => {
    // ... (votre code existant reste identique ici) ...
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;

    if (!user && !isLoginPage) {
        goto('/');
    }
    if (user && isLoginPage) {
        goto('/accueil');
    }

    if (typeof localStorage !== 'undefined') {
      isChristmasTheme = localStorage.getItem('bacoChristmasTheme') !== 'false';
    }
    
    loading = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      user = session?.user;
      if (event === 'SIGNED_OUT') goto('/');
    });

    return () => subscription.unsubscribe();
  });

  function handleKeydown(event) {
    if (event.key === 'Escape' && $zenMode) {
        zenMode.set(false);
    }
  }
</script>
<svelte:window on:keydown={handleKeydown} />

{#if loading && !isLoginPage}
  <DashboardSkeleton />
{:else}
  <div class="min-h-screen flex flex-col bg-deep-space text-gray-900 dark:text-gray-100 transition-colors duration-300">
    
{#if !isLoginPage && !$zenMode}
    <div transition:fade={{ duration: 200 }}>
        <Nav {user} />
        <GlobalSearch />
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
        <span class="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Quitter le mode Zen
        </span>
    </button>
  {/if}

  <ToastContainer />
  <ConfirmModal />
</div>