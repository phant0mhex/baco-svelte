<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { dndzone } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { Settings, Save, Maximize, Minimize, GripHorizontal, Search, BookCopy, CalendarDays, Zap } from 'lucide-svelte';
  
  // --- IMPORTS DES WIDGETS ---
  import WidgetWeather from '$lib/components/widgets/WidgetWeather.svelte';
  import WidgetTrains from '$lib/components/widgets/WidgetTrains.svelte';
  import WidgetTraffic from '$lib/components/widgets/WidgetTraffic.svelte';
  import WidgetPmr from '$lib/components/widgets/WidgetPmr.svelte';
  import WidgetJournal from '$lib/components/widgets/WidgetJournal.svelte';
  import WidgetPlanning from '$lib/components/widgets/WidgetPlanning.svelte'; // Nouveau
  import WidgetLinks from '$lib/components/widgets/WidgetLinks.svelte';       // Nouveau

  let userProfile = null;
  let isEditMode = false;
  const flipDurationMs = 300;

  // Mapping des composants pour l'affichage dynamique
  const WIDGET_TYPES = {
    weather: WidgetWeather,
    trains: WidgetTrains,
    traffic: WidgetTraffic,
    pmr: WidgetPmr,
    journal: WidgetJournal,
    planning: WidgetPlanning,
    links: WidgetLinks
  };

  // Disposition par défaut (Ordre initial)
  const DEFAULT_LAYOUT = [
    { id: 1, type: 'weather', title: 'Météo', cols: 1 },
    { id: 2, type: 'trains', title: 'Départs', cols: 2 },
    { id: 3, type: 'traffic', title: 'Info Trafic', cols: 1 },
    { id: 4, type: 'pmr', title: 'Rampes PMR', cols: 1 },
    { id: 5, type: 'journal', title: 'Journal', cols: 1 },
    { id: 6, type: 'planning', title: 'Planning', cols: 1 }, // Nouveau
    { id: 7, type: 'links', title: 'Raccourcis', cols: 2 }   // Nouveau (Pleine largeur)
  ];

  let items = DEFAULT_LAYOUT;

  onMount(async () => {
    // 1. Charger User
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();
        userProfile = data;
    }

    // 2. Charger Layout Sauvegardé
    const saved = localStorage.getItem('baco_dashboard_layout_v3'); // J'ai changé la clé en v3 pour forcer la maj des nouveaux widgets
    if (saved) {
        try { 
            const parsed = JSON.parse(saved);
            // Vérification simple pour s'assurer que les nouveaux widgets sont là (sinon on recharge le défaut)
            const hasLinks = parsed.some(i => i.type === 'links');
            if (hasLinks) {
                items = parsed;
            } else {
                // Si l'utilisateur a une vieille config sans les liens, on reset (ou on pourrait merger)
                items = DEFAULT_LAYOUT;
            }
        } catch (e) { console.error(e); }
    }
  });

  // --- LOGIQUE DRAG & DROP & RESIZE ---
  function handleDndConsider(e) { items = e.detail.items; }
  
  function handleDndFinalize(e) { 
      items = e.detail.items; 
      saveLayout(); 
  }

  function toggleSize(id) {
    items = items.map(i => i.id === id ? { ...i, cols: i.cols === 2 ? 1 : 2 } : i);
    saveLayout();
  }

  function saveLayout() { 
      localStorage.setItem('baco_dashboard_layout_v3', JSON.stringify(items)); 
  }

  function toggleEditMode() { 
      isEditMode = !isEditMode; 
      if(!isEditMode) saveLayout(); 
  }
  
  function handleSearch() { 
      window.dispatchEvent(new CustomEvent('openGlobalSearch')); 
  }
</script>

<svelte:head>
  <title>Accueil - Portail BACO</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8 space-y-8 pb-20">
  
  <header class="flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-4">
      {#if userProfile?.avatar_url}
        <img src={userProfile.avatar_url} alt="Avatar" class="w-16 h-16 rounded-full object-cover shadow-[0_0_20px_rgba(255,255,255,0.15)] border border-white/10">
      {/if}
      <div>
        <h2 class="text-3xl font-bold text-white tracking-tight">
          Bonjour, <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">{userProfile?.full_name || 'Utilisateur'}</span>
        </h2>
        <p class="text-gray-400 text-sm">Tableau de bord.</p>
      </div>
    </div>

    <button 
        on:click={toggleEditMode} 
        class="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shadow-lg 
        {isEditMode ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/20' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}"
    >
        {#if isEditMode} <Save class="w-4 h-4" /> Terminer {:else} <Settings class="w-4 h-4" /> Personnaliser {/if}
    </button>
  </header>

  <section 
    use:dndzone="{{items, flipDurationMs, dragDisabled: !isEditMode, dropTargetStyle: {outline: 'none'}}}" 
    on:consider={handleDndConsider} 
    on:finalize={handleDndFinalize}
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
  >
    {#each items as item (item.id)}
        <div 
            class="relative transition-all duration-300 rounded-2xl
                   {item.cols === 2 ? 'md:col-span-2' : 'md:col-span-1'} 
                   {isEditMode ? 'z-10 ring-2 ring-blue-500/50' : ''}"
            animate:flip="{{duration: flipDurationMs}}"
        >
            <div class="h-full min-h-[350px] {isEditMode ? 'pointer-events-none opacity-50 blur-[1px]' : ''}">
                <svelte:component this={WIDGET_TYPES[item.type]} />
            </div>

            {#if isEditMode}
                <div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10">
                    
                    <div class="p-4 bg-blue-600 rounded-full shadow-xl cursor-grab active:cursor-grabbing mb-4 hover:scale-110 transition-transform">
                        <GripHorizontal class="w-6 h-6 text-white" />
                    </div>
                    
                    <div class="flex items-center gap-3 bg-[#0f1115] rounded-full px-5 py-2 border border-white/20 shadow-2xl">
                        <span class="text-xs font-bold text-gray-300 uppercase tracking-wider">{item.title}</span>
                        <div class="w-px h-4 bg-white/20 mx-1"></div>
                        <button 
                            on:click|stopPropagation={() => toggleSize(item.id)} 
                            class="p-1.5 hover:bg-white/20 rounded-lg text-blue-400 hover:text-white transition-colors" 
                            title={item.cols === 2 ? "Réduire" : "Agrandir"}
                        >
                            {#if item.cols === 2} <Minimize class="w-4 h-4"/> {:else} <Maximize class="w-4 h-4"/> {/if}
                        </button>
                    </div>

                </div>
            {/if}
        </div>
    {/each}
  </section>

</div>