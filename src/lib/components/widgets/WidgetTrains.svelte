<script>
    import { onMount } from 'svelte';
    import { TrainFront, Search, X, Edit2, Clock } from 'lucide-svelte';

    let currentStation = 'Mons';
    let allStations = [];
    let stationSearch = '';
    let showStationSelector = false;
    let trainDepartures = [];
    let loading = true;

    $: filteredStations = allStations.filter(s => s.name.toLowerCase().includes(stationSearch.toLowerCase())).slice(0, 10);

    onMount(() => {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('bacoFavoriteStation');
            if (saved) currentStation = saved;
        }
        loadAllStations();
        loadTrains();
    });

    async function loadAllStations() {
        try {
            const res = await fetch('https://api.irail.be/stations/?format=json&lang=fr');
            const data = await res.json();
            allStations = data.station;
        } catch (e) { console.error(e); }
    }

    async function loadTrains() {
        loading = true;
        try {
            const res = await fetch(`https://api.irail.be/liveboard/?station=${encodeURIComponent(currentStation)}&format=json&lang=fr`);
            const data = await res.json();
            if (data?.departures?.departure) {
                const all = Array.isArray(data.departures.departure) ? data.departures.departure : [data.departures.departure];
                const now = Math.floor(Date.now() / 1000);
                trainDepartures = all.filter(t => parseInt(t.time) <= now + (2 * 60 * 60));
            }
        } catch (e) { console.error(e); }
        loading = false;
    }

    function selectStation(name) {
        currentStation = name;
        showStationSelector = false;
        localStorage.setItem('bacoFavoriteStation', name);
        loadTrains();
    }

    const formatTrainTime = (ts) => new Date(ts * 1000).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
    
    // Fonction pour formater le numéro de train (ex: BE.NMBS.IC1234 -> IC1234)
    const formatTrainId = (id) => {
        if (!id) return '';
        return id.replace('BE.NMBS.', '');
    }
</script>

<div class="glass-panel rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex flex-col h-full min-h-[350px] relative overflow-hidden">
    <div class="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02] sticky top-0 z-20 backdrop-blur-xl min-h-[80px]">
        {#if showStationSelector}
            <div class="flex-1 flex items-center gap-2 animate-in fade-in">
                <div class="relative flex-1">
                    <Search class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/>
                    <input type="text" bind:value={stationSearch} placeholder="Gare..." class="w-full bg-black/40 border border-blue-500/50 rounded-xl py-2 pl-9 text-sm text-white focus:outline-none" autoFocus />
                    {#if stationSearch.length > 1}
                        <div class="absolute top-full left-0 right-0 mt-2 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                            {#each filteredStations as station}
                                <button on:click={() => selectStation(station.name)} class="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-blue-600 hover:text-white transition-colors border-b border-white/5">{station.name}</button>
                            {/each}
                        </div>
                    {/if}
                </div>
                <button on:click={() => showStationSelector = false} class="p-2 hover:bg-white/10 rounded-lg text-gray-400"><X class="w-5 h-5" /></button>
            </div>
        {:else}
            <div class="flex items-center gap-3 cursor-pointer group" on:click={() => showStationSelector = true}>
                <div class="p-2 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white transition-colors"><TrainFront class="w-5 h-5" /></div>
                <div>
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">Gare de {currentStation} <Edit2 class="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400" /></h3>
                    <p class="text-[10px] text-gray-400 uppercase">Départs (2h)</p>
                </div>
            </div>
        {/if}
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar">
        {#if loading}
            <div class="flex items-center justify-center h-40"><div class="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>
        {:else if trainDepartures.length > 0}
            <div class="divide-y divide-white/5 text-sm">
                {#each trainDepartures as train}
                    {@const isCanceled = train.canceled === "1"}
                    <div class="flex items-center justify-between p-3.5 hover:bg-white/[0.03] transition-colors {isCanceled ? 'opacity-50 grayscale' : ''}">
                        <div class="flex items-center gap-4">
                            <span class="font-mono font-bold text-lg {isCanceled ? 'text-gray-500 line-through' : 'text-blue-300'}">{formatTrainTime(train.time)}</span>
                            <div>
                                <span class="block font-bold text-gray-200">{train.station}</span>
                                <span class="block text-[10px] text-gray-400">{formatTrainId(train.vehicle)}</span>
                                {#if train.delay > 0 && !isCanceled}<span class="text-[10px] font-bold text-red-400">+{Math.floor(train.delay / 60)}'</span>{/if}
                            </div>
                        </div>
                        <div class="flex flex-col items-end"><span class="text-[10px] text-gray-500">Voie</span><span class="font-bold text-white">{train.platform || '?'}</span></div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="flex flex-col items-center justify-center h-40 text-gray-500 gap-2"><Clock class="w-8 h-8 opacity-50" /><p class="text-sm">Aucun départ.</p></div>
        {/if}
    </div>
</div>