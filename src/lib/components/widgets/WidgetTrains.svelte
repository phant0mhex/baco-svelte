<script>
    import { onMount } from 'svelte';
    import { TrainFront, Search, X, Edit2, Clock, AlertTriangle } from 'lucide-svelte';
    import { slide } from 'svelte/transition';

    // --- RUNES : Props ---
    let { compact = false } = $props();

    // --- ÉTAT GLOBAL ---
    let currentStation = $state('Mons');
    let allStations = $state([]);
    let trainDepartures = $state([]);
    let loading = $state(true);

    // --- ÉTAT SÉLECTEUR DE GARE ---
    let showStationSelector = $state(false);
    let stationSearch = $state('');

    // --- ÉTAT RECHERCHE TRAINS (FILTRE) ---
    let isSearchOpen = $state(false);
    let searchQuery = $state("");

    // --- LOGIQUE DÉRIVÉE ($derived) ---

    // 1. Filtrer la liste des gares pour le sélecteur
    let filteredStations = $derived.by(() => {
        if (!stationSearch) return allStations.slice(0, 10); // Top 10 par défaut
        return allStations
            .filter(s => s.name.toLowerCase().includes(stationSearch.toLowerCase()))
            .slice(0, 20);
    });

    // 2. Filtrer les trains affichés (Recherche utilisateur)
    let filteredTrains = $derived.by(() => {
        // Si pas de recherche, on renvoie tout
        if (!searchQuery.trim()) return trainDepartures;

        const q = searchQuery.toLowerCase();
        return trainDepartures.filter(t => 
            // Recherche dans la station (Destination)
            t.station.toLowerCase().includes(q) || 
            // Recherche dans le numéro de train (vehicle)
            (t.vehicle && t.vehicle.toLowerCase().includes(q))
        );
    });

    // --- CHARGEMENT DONNÉES ---

    onMount(async () => {
        // Récupérer la dernière gare choisie
        const saved = localStorage.getItem('bacoFavoriteStation');
        if (saved) currentStation = saved;

        await loadAllStations();
        await loadTrains();
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
                // On garde les trains des 3 prochaines heures
                trainDepartures = all.filter(t => parseInt(t.time) <= now + (3 * 60 * 60));
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

    // --- FORMATTERS ---

    const formatTrainNum = (vehicleStr) => {
        if (!vehicleStr) return '';
        return vehicleStr.replace('BE.NMBS.', '');
    };

    const formatTrainTime = (ts) => new Date(ts * 1000).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
</script>

<div class="glass-panel rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex flex-col h-full relative overflow-hidden group">
    
    <div class="{compact ? 'p-2 min-h-[40px]' : 'p-4 min-h-[60px]'} border-b border-white/5 flex justify-between items-center bg-white/[0.02] sticky top-0 z-20 backdrop-blur-xl shrink-0">
        
        {#if showStationSelector}
            <div class="flex-1 flex items-center gap-2 animate-in fade-in w-full">
                <div class="relative flex-1">
                    <Search class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/>
                    <input type="text" bind:value={stationSearch} placeholder="Changer de gare..." class="w-full bg-black/40 border border-blue-500/50 rounded-xl py-2 pl-9 text-sm text-white focus:outline-none" autoFocus />
                    
                    {#if filteredStations.length > 0}
                        <div class="absolute top-full left-0 right-0 mt-2 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                            {#each filteredStations as station}
                                <button onclick={() => selectStation(station.name)} class="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-blue-600 hover:text-white transition-colors border-b border-white/5">
                                    {station.name}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
                <button onclick={() => showStationSelector = false} class="p-2 hover:bg-white/10 rounded-lg text-gray-400">
                    <X class="w-5 h-5" />
                </button>
            </div>

        {:else}
            {#if !isSearchOpen || !compact}
                <button 
                    class="flex items-center gap-3 cursor-pointer group/title text-left focus:outline-none" 
                    onclick={() => showStationSelector = true}
                >
                    {#if !compact}
                        <div class="p-2 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 group-hover/title:bg-blue-500 group-hover/title:text-white transition-colors">
                            <TrainFront class="w-5 h-5" />
                        </div>
                    {/if}
                    <div>
                        <h3 class="{compact ? 'text-sm' : 'text-base'} font-bold text-white flex items-center gap-2">
                            {currentStation} 
                            {#if !compact}<Edit2 class="w-3 h-3 text-gray-600 group-hover/title:text-blue-400" />{/if}
                        </h3>
                        {#if !compact}
                            <p class="text-[10px] text-gray-400 uppercase tracking-wider">Prochains départs</p>
                        {/if}
                    </div>
                </button>
            {/if}

            <div class="flex items-center gap-2 ml-auto">
                {#if isSearchOpen}
                    <div class="flex items-center bg-white/10 rounded-lg border border-white/10 overflow-hidden" transition:slide={{ axis: 'x', duration: 300 }}>
                        <input 
                            type="text"
                            bind:value={searchQuery}
                            placeholder="N° ou Destination..."
                            class="bg-transparent border-none text-white text-xs px-2 py-1 w-32 focus:ring-0 placeholder-white/30 focus:outline-none"
                            autofocus
                        />
                        <button 
                            onclick={() => { searchQuery = ""; isSearchOpen = false; }}
                            class="p-1 hover:text-white text-gray-400"
                        >
                            <X size={14} />
                        </button>
                    </div>
                {:else}
                    <button 
                        onclick={() => isSearchOpen = true}
                        class="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
                        title="Filtrer les trains"
                    >
                        <Search size={compact ? 16 : 18} />
                    </button>
                {/if}
            </div>

        {/if}
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar">
        {#if loading}
            <div class="divide-y divide-white/5 animate-pulse">
                {#each Array(compact ? 4 : 5) as _}
                    <div class="{compact ? 'p-1.5' : 'p-3'} flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="h-4 w-10 bg-white/10 rounded"></div>
                            <div class="h-4 w-24 bg-white/10 rounded"></div>
                        </div>
                        <div class="h-5 w-6 bg-white/5 rounded"></div>
                    </div>
                {/each}
            </div>
        {:else if filteredTrains.length > 0}
            <div class="divide-y divide-white/5 text-sm">
                {#each filteredTrains as train (train.id || train.vehicle + train.time)}
                    {@const isCanceled = train.canceled === "1"}
                    
                    <div class="flex items-center justify-between {compact ? 'p-1.5' : 'p-3'} hover:bg-white/[0.03] transition-colors {isCanceled ? 'opacity-50' : ''}">
                        
                        <div class="flex items-center gap-3">
                            <span class="font-mono font-bold {compact ? 'text-xs' : 'text-base'} {isCanceled ? 'text-gray-500 line-through' : 'text-blue-300'}">
                                {formatTrainTime(train.time)}
                            </span>
                            
                            <div>
                                <span class="block font-bold text-gray-200 {compact ? 'text-xs' : 'text-sm'} leading-tight">
                                    {train.station}
                                </span>
                                
                                <span class="block text-[10px] text-blue-400/80 font-mono leading-none mt-0.5 mb-0.5">
                                    {formatTrainNum(train.vehicle)}
                                </span>

                                {#if train.delay > 0 && !isCanceled}
                                    <span class="text-[10px] font-bold text-red-400 flex items-center gap-0.5">
                                        +{Math.floor(train.delay / 60)}'
                                    </span>
                                {/if}
                                {#if isCanceled}
                                    <span class="text-[9px] font-bold text-red-500 uppercase">Supprimé</span>
                                {/if}
                            </div>
                        </div>

                        <div class="flex flex-col items-end">
                            {#if !compact}<span class="text-[9px] text-gray-500 uppercase">Voie</span>{/if}
                            <span class="font-bold text-white bg-white/5 px-1.5 rounded border border-white/10">
                                {train.platform || '?'}
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="flex flex-col items-center justify-center h-full text-gray-500 gap-2 opacity-60">
                {#if searchQuery}
                    <Search class="w-8 h-8" />
                    <p class="text-xs">Aucun train ne correspond.</p>
                {:else}
                    <Clock class="w-8 h-8" />
                    <p class="text-xs">Aucun départ prévu.</p>
                {/if}
            </div>
        {/if}
    </div>
</div>