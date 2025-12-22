<script>
  import { onMount } from 'svelte';
  import { TriangleAlert, Info, ShieldCheck } from 'lucide-svelte';

  let disturbances = [];
  let loading = true;

  onMount(() => {
    fetchDisturbances();
  });

  async function fetchDisturbances() {
    try {
      loading = true;
      const response = await fetch('https://api.irail.be/disturbances/?format=json&lang=fr');
      const data = await response.json();
      if (data && data.disturbance) {
        disturbances = Array.isArray(data.disturbance) ? data.disturbance : [data.disturbance];
      } else {
        disturbances = [];
      }
    } catch (e) {
      console.error("Erreur perturbations:", e);
    } finally {
      loading = false;
    }
  }

  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
</script>

<div class="glass-panel p-5 rounded-2xl border border-white/10 h-full flex flex-col relative overflow-hidden">
    <div class="flex justify-between items-center mb-4 z-10">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <div class="p-2 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <TriangleAlert class="w-5 h-5" />
            </div>
            Info Trafic
        </h2>
        
        {#if disturbances.length > 0}
            <span class="px-2 py-1 bg-red-500/20 text-red-300 text-[10px] font-bold rounded-full border border-red-500/30 animate-pulse">
                {disturbances.length} incident(s)
            </span>
        {:else}
            <span class="px-2 py-1 bg-green-500/20 text-green-300 text-[10px] font-bold rounded-full border border-green-500/30">
                Fluide
            </span>
        {/if}
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar z-10 space-y-3 pr-1">
        {#if loading}
            <div class="space-y-3 animate-pulse">
                {#each Array(3) as _}
                    <div class="bg-white/5 rounded-xl p-3 border border-white/5">
                        <div class="flex justify-between mb-2">
                            <div class="h-3 w-1/3 bg-white/10 rounded"></div>
                            <div class="h-3 w-10 bg-white/10 rounded"></div>
                        </div>
                        <div class="space-y-1">
                            <div class="h-2 w-full bg-white/5 rounded"></div>
                            <div class="h-2 w-2/3 bg-white/5 rounded"></div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if disturbances.length === 0}
            <div class="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
                <ShieldCheck class="w-10 h-10 mb-2 text-green-400/50" />
                <p class="text-xs">Réseau fluide</p>
            </div>
        {:else}
            {#each disturbances as dist}
                <div class="bg-black/20 border border-white/5 rounded-xl p-3 hover:bg-black/30 transition-colors">
                    <div class="flex justify-between items-start gap-2 mb-1">
                        <h3 class="text-xs font-bold text-orange-200 leading-tight">{dist.title}</h3>
                        <span class="text-[10px] text-gray-500 whitespace-nowrap">{formatTime(dist.timestamp)}</span>
                    </div>
                    <p class="text-[10px] text-gray-400 line-clamp-3 leading-relaxed">{dist.description}</p>
                </div>
            {/each}
        {/if}
    </div>
</div>