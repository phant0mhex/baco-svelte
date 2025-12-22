<script>
  import { onMount } from 'svelte';
  import { TriangleAlert, ShieldCheck, Hammer, Construction } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  // --- RUNES : Props ---
  let { compact = false } = $props();

  // --- RUNES : État ---
  let allDisturbances = $state([]);
  let activeTab = $state('incidents'); // 'incidents' ou 'works'
  let loading = $state(true);

  // --- RUNES : Dérivés (CORRECTION ICI) ---
  // On considère comme "Travaux" uniquement ce qui est explicitement "planned"
  let works = $derived(allDisturbances.filter(d => d.type === 'planned'));
  
  // Tout le reste (disturbance, unplanned, etc.) va dans "Incidents" pour ne rien rater
  let incidents = $derived(allDisturbances.filter(d => d.type !== 'planned'));
  
  // Liste à afficher selon l'onglet actif
  let currentList = $derived(activeTab === 'incidents' ? incidents : works);

  onMount(() => {
    fetchDisturbances();
  });

  async function fetchDisturbances() {
    try {
      loading = true;
      // Ajout d'un timestamp pour éviter le cache navigateur
      const response = await fetch(`https://api.irail.be/disturbances/?format=json&lang=fr&t=${Date.now()}`);
      const data = await response.json();
      
      if (data && data.disturbance) {
        // L'API renvoie parfois un objet unique au lieu d'un tableau
        allDisturbances = Array.isArray(data.disturbance) ? data.disturbance : [data.disturbance];
      } else {
        allDisturbances = [];
      }
    } catch (e) {
      console.error("Erreur perturbations:", e);
      allDisturbances = [];
    } finally {
      loading = false;
    }
  }

  const formatTime = (ts) => {
      if (!ts) return '';
      return new Date(parseInt(ts) * 1000).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  };
</script>

<div class="glass-panel {compact ? 'p-2' : 'p-5'} rounded-2xl border border-white/10 h-full flex flex-col relative overflow-hidden transition-all duration-300">
    
    <div class="flex justify-between items-center {compact ? 'mb-2' : 'mb-4'} z-10 border-b border-white/5 pb-2">
        <div class="flex items-center gap-2">
            {#if !compact}
                <div class="p-2 rounded-lg {activeTab === 'incidents' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'} transition-colors duration-300">
                    {#if activeTab === 'incidents'}
                        <TriangleAlert class="w-5 h-5" />
                    {:else}
                        <Hammer class="w-5 h-5" />
                    {/if}
                </div>
                <h2 class="text-lg font-bold text-white">Trafic</h2>
            {:else}
                {#if activeTab === 'incidents'}
                    <TriangleAlert class="w-4 h-4 text-red-400" />
                {:else}
                    <Hammer class="w-4 h-4 text-orange-400" />
                {/if}
                <span class="text-sm font-bold text-white">Trafic</span>
            {/if}
        </div>

        <div class="flex bg-black/20 rounded-lg p-1 items-center">
            <button 
                onclick={() => activeTab = 'incidents'}
                class="px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1
                {activeTab === 'incidents' ? 'bg-red-500/20 text-red-300 shadow-sm border border-red-500/10' : 'text-gray-500 hover:text-gray-300'}"
            >
                {#if incidents.length > 0}
                    <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                {/if}
                Incid.
            </button>
            <button 
                onclick={() => activeTab = 'works'}
                class="px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1
                {activeTab === 'works' ? 'bg-orange-500/20 text-orange-300 shadow-sm border border-orange-500/10' : 'text-gray-500 hover:text-gray-300'}"
            >
                {#if works.length > 0}
                    <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                {/if}
                Travaux
            </button>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar z-10 space-y-3 pr-1">
        {#if loading}
            <div class="space-y-3 animate-pulse">
                {#each Array(compact ? 2 : 3) as _}
                    <div class="bg-white/5 rounded-xl {compact ? 'p-2' : 'p-3'} border border-white/5">
                        <div class="flex justify-between mb-2">
                            <div class="h-3 w-1/3 bg-white/10 rounded"></div>
                            <div class="h-3 w-10 bg-white/10 rounded"></div>
                        </div>
                        {#if !compact}
                            <div class="space-y-1">
                                <div class="h-2 w-full bg-white/5 rounded"></div>
                                <div class="h-2 w-2/3 bg-white/5 rounded"></div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>

        {:else if currentList.length === 0}
            <div class="h-full flex flex-col items-center justify-center text-gray-500 opacity-60" in:slide>
                <ShieldCheck class="{compact ? 'w-6 h-6' : 'w-10 h-10'} mb-2 text-green-400/50" />
                <p class="text-xs">
                    {activeTab === 'incidents' ? 'Réseau fluide' : 'Aucun travaux'}
                </p>
            </div>

        {:else}
            <div in:slide={{ duration: 200 }}>
                {#each currentList as dist (dist.id || (dist.timestamp + dist.title))}
                    <div class="bg-black/20 border border-white/5 rounded-xl {compact ? 'p-2' : 'p-3'} hover:bg-black/30 transition-colors mb-2">
                        <div class="flex justify-between items-start gap-2 mb-1">
                            <h3 class="{compact ? 'text-[10px]' : 'text-xs'} font-bold {activeTab === 'incidents' ? 'text-red-200' : 'text-orange-200'} leading-tight">
                                {dist.title}
                            </h3>
                            <span class="{compact ? 'text-[9px]' : 'text-[10px]'} text-gray-500 whitespace-nowrap">
                                {formatTime(dist.timestamp)}
                            </span>
                        </div>
                        {#if !compact}
                            <p class="text-[10px] text-gray-400 line-clamp-3 leading-relaxed">
                                {dist.description}
                            </p>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>