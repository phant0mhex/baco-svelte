<script>
  import { onMount } from 'svelte';
  import { dndzone } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { supabase } from '$lib/supabase';
  import { fade, fly } from 'svelte/transition';
  
  // Imports Widgets et Icônes (inchangés)
  import WidgetWeather from '$lib/components/widgets/WidgetWeather.svelte';
  import WidgetTraffic from '$lib/components/widgets/WidgetTraffic.svelte';
  import WidgetTrains from '$lib/components/widgets/WidgetTrains.svelte';
  import WidgetPmr from '$lib/components/widgets/WidgetPmr.svelte';
  import WidgetLinks from '$lib/components/widgets/WidgetLinks.svelte';
  import WidgetPlanning from '$lib/components/widgets/WidgetPlanning.svelte';
  import WidgetJournal from '$lib/components/widgets/WidgetJournal.svelte';
  import WidgetNotepad from '$lib/components/widgets/WidgetNotepad.svelte';
  import WidgetShift from '$lib/components/widgets/WidgetShift.svelte';

  import { 
    LayoutGrid, Cloud, Loader2, Plus, X, 
    Sun, Car, TrainFront, Accessibility, Link, Calendar, BookOpen, PenLine, Briefcase,
    Settings2 
  } from 'lucide-svelte';
  import { toast } from '$lib/stores/toast';

  const WIDGET_REGISTRY = {
    weather: { label: 'Météo', component: WidgetWeather, defaultSize: 'col-span-1', defaultRows: 'row-span-1', icon: Sun, desc: 'Prévisions et conditions actuelles.' },
    shift: { label: 'Mon Service', component: WidgetShift, defaultSize: 'col-span-1 md:col-span-2', defaultRows: 'row-span-1', icon: Briefcase, desc: 'Suivi de shift.' },
    notepad: { label: 'Bloc-notes', component: WidgetNotepad, defaultSize: 'col-span-1', defaultRows: 'row-span-1', icon: PenLine, desc: 'Notes rapides.' },
    traffic: { label: 'Info Trafic', component: WidgetTraffic, defaultSize: 'col-span-1', defaultRows: 'row-span-1', icon: Car, desc: 'Incidents.' },
    trains:  { label: 'Trains', component: WidgetTrains, defaultSize: 'col-span-1 md:col-span-2', defaultRows: 'row-span-1', icon: TrainFront, desc: 'Départs.' },
    pmr:     { label: 'PMR', component: WidgetPmr, defaultSize: 'col-span-1 md:col-span-2', defaultRows: 'row-span-1', icon: Accessibility, desc: 'Assistances.' },
    links:   { label: 'Raccourcis', component: WidgetLinks, defaultSize: 'col-span-1', defaultRows: 'row-span-1', icon: Link, desc: 'Liens utiles.' },
    planning:{ label: 'Planning', component: WidgetPlanning, defaultSize: 'col-span-1', defaultRows: 'row-span-2', icon: Calendar, desc: 'Effectifs.' },
    journal: { label: 'Journal', component: WidgetJournal, defaultSize: 'col-span-full', defaultRows: 'row-span-1', icon: BookOpen, desc: 'Main courante.' }
  };

  // --- ÉTAT AVEC RUNES ---
  let items = $state([]);
  let user = $state(null);
  let isSaving = $state(false);
  let isDrawerOpen = $state(false);
  
  // Variables locales (non réactives au sens Svelte, juste des références)
  let saveTimeout;
  const flipDurationMs = 300;

  const DEFAULT_LAYOUT = [
    { id: 'def-1', type: 'weather' },
    { id: 'def-2', type: 'planning' },
    { id: 'def-3', type: 'links' },
    { id: 'def-4', type: 'trains' }
  ];

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;

    const localConfig = localStorage.getItem('baco_dashboard_config_v2');
    if (localConfig) {
      items = JSON.parse(localConfig);
    } else {
      items = DEFAULT_LAYOUT.map(i => ({ ...i, id: crypto.randomUUID() }));
    }

    if (user) {
       try {
         const { data } = await supabase.from('user_preferences').select('dashboard_config').eq('user_id', user.id).single();
         if (data?.dashboard_config) {
             items = data.dashboard_config;
             saveToLocal(items);
         }
       } catch (e) { console.error(e); }
    }
  });

  function toggleDrawer() { isDrawerOpen = !isDrawerOpen; }

  function addWidget(type) {
    const newWidget = { id: crypto.randomUUID(), type: type };
    // Avec $state, on peut souvent faire items.push(newWidget), 
    // mais pour dndzone, il vaut mieux réassigner le tableau.
    items = [newWidget, ...items];
    triggerSave();
    toast.success(`${WIDGET_REGISTRY[type].label} ajouté`);
  }

  function removeWidget(id) {
    items = items.filter(item => item.id !== id);
    triggerSave();
  }

  function saveToLocal(newItems) {
    localStorage.setItem('baco_dashboard_config_v2', JSON.stringify(newItems));
  }

  function triggerSave() {
    saveToLocal(items);
    if (user) {
        isSaving = true;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            await supabase.from('user_preferences').upsert({ 
                user_id: user.id, 
                dashboard_config: items,
                updated_at: new Date()
            }, { onConflict: 'user_id' });
            isSaving = false;
        }, 2000);
    }
  }

  // Handlers DND
  function handleDndConsider(e) { items = e.detail.items; }
  function handleDndFinalize(e) { items = e.detail.items; triggerSave(); }
</script>

<div class="space-y-6 relative">
  <div class="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-md">
    <div class="flex items-center gap-3">
        <LayoutGrid class="text-blue-400" />
        <h2 class="text-xl font-bold text-white">Mon Tableau de Bord</h2>
    </div>

    <div class="flex items-center gap-4">
        {#if isSaving}
            <span class="text-xs text-blue-300 flex items-center gap-1" transition:fade>
                <Loader2 class="w-3 h-3 animate-spin"/> Sauvegarde...
            </span>
        {:else}
            <span class="text-xs text-green-400/50 flex items-center gap-1" transition:fade>
                <Cloud class="w-3 h-3"/> Synchro
            </span>
        {/if}

        <button 
            onclick={toggleDrawer}
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border
            {isDrawerOpen 
                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'}"
        >
            <Settings2 class="w-4 h-4" />
            <span>{isDrawerOpen ? 'Fermer' : 'Personnaliser'}</span>
        </button>
    </div>
  </div>

  <section 
    use:dndzone={{items, flipDurationMs, dropTargetStyle: { outline: '2px dashed rgba(59,130,246,0.5)', borderRadius: '1rem' }}} 
    onconsider={handleDndConsider} 
    onfinalize={handleDndFinalize}
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 pb-20 min-h-[50vh] auto-rows-[280px]"
  >
    {#each items as item (item.id)}
      <div 
        animate:flip={{duration: flipDurationMs}}
        class="{WIDGET_REGISTRY[item.type]?.defaultSize || 'col-span-1'} {WIDGET_REGISTRY[item.type]?.defaultRows || 'row-span-1'} relative group"
      >
        {#if WIDGET_REGISTRY[item.type]}
            <div class="h-full w-full {isDrawerOpen ? 'pointer-events-none opacity-80' : ''}">
                <svelte:component this={WIDGET_REGISTRY[item.type].component} {...item} />
            </div>
        {/if}

        {#if isDrawerOpen}
            <div 
                transition:fade={{duration: 150}}
                class="absolute inset-0 bg-blue-900/10 border-2 border-blue-500/50 rounded-xl z-20 flex items-center justify-center backdrop-blur-[2px]"
            >
                <button 
                    onclick={() => removeWidget(item.id)}
                    class="transform hover:scale-110 transition-transform bg-red-500 text-white p-3 rounded-full shadow-xl flex items-center gap-2 cursor-pointer"
                >
                    <X size={20} />
                    <span class="font-bold text-sm">Supprimer</span>
                </button>
            </div>
        {/if}
      </div>
    {/each}
  </section>
</div>