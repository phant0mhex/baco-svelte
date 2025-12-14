<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Route, MapPin, TrainTrack, Milestone, Building2, Tag, Info, Loader2, Filter
  } from 'lucide-svelte';

  // --- ÉTAT ---
  let availableLines = [];
  let isLoadingFilters = true;
  let isLoadingResults = false;

  // Sélections
  let selectedCategories = []; // ['Lignes', 'Adresse PN', 'Zone SPI']
  let selectedLines = [];
  let selectedZones = []; // ['FTY', 'FMS', 'FCR'] (valeurs par défaut vides)

  // Résultats structurés : { "L.75": { gares: [], pn: [], spi: [] } }
  let results = {}; 

  onMount(async () => {
    await loadLineFilters();
  });

  // --- CHARGEMENT FILTRES ---

  async function loadLineFilters() {
    isLoadingFilters = true;
    try {
      const [pn, spi, gares] = await Promise.all([
        supabase.from('pn_data').select('ligne_nom'),
        supabase.from('spi_data').select('ligne_nom'),
        supabase.from('ligne_data').select('ligne_nom')
      ]);

      const allLines = [
        ...(pn.data || []).map(i => i.ligne_nom),
        ...(spi.data || []).map(i => i.ligne_nom),
        ...(gares.data || []).map(i => i.ligne_nom)
      ];

      // Unique + Tri intelligent (ex: L.75A après L.75)
      availableLines = [...new Set(allLines.filter(Boolean))].sort((a, b) => {
        const parseLine = (str) => parseFloat(str.replace('L.', '').replace('A', '.1').replace('C', '.2'));
        return parseLine(a) - parseLine(b);
      });

    } catch (e) {
      console.error("Erreur chargement lignes:", e);
    } finally {
      isLoadingFilters = false;
    }
  }

  // --- CHARGEMENT RÉSULTATS ---

  // Déclenché à chaque changement de filtre
  async function updateDisplay() {
    if (selectedCategories.length === 0 || selectedLines.length === 0) {
      results = {};
      return;
    }

    isLoadingResults = true;
    const newResults = {};
    
    // Initialiser la structure pour chaque ligne sélectionnée
    selectedLines.forEach(line => {
      newResults[line] = { gares: [], pn: [], spi: [] };
    });

    try {
      const promises = [];

      // 1. Gares
      if (selectedCategories.includes("Lignes")) {
        promises.push(
          supabase.from('ligne_data')
            .select('ligne_nom, gare')
            .in('ligne_nom', selectedLines)
            .order('ordre')
            .then(res => ({ type: 'gares', data: res.data || [] }))
        );
      }

      // 2. PN
      if (selectedCategories.includes("Adresse PN")) {
        promises.push(
          supabase.from('pn_data')
            .select('*')
            .in('ligne_nom', selectedLines)
            .then(res => ({ type: 'pn', data: res.data || [] }))
        );
      }

      // 3. SPI (avec filtre zone optionnel)
      if (selectedCategories.includes("Zone SPI")) {
        let q = supabase.from('spi_data').select('*').in('ligne_nom', selectedLines);
        if (selectedZones.length > 0) {
          q = q.in('zone', selectedZones);
        }
        promises.push(q.then(res => ({ type: 'spi', data: res.data || [] })));
      }

      const responses = await Promise.all(promises);

      // Répartir les données dans newResults
      responses.forEach(res => {
        res.data.forEach(item => {
          if (newResults[item.ligne_nom]) {
            newResults[item.ligne_nom][res.type].push(item);
          }
        });
      });

      results = newResults;

    } catch (e) {
      console.error("Erreur chargement données:", e);
    } finally {
      isLoadingResults = false;
    }
  }

  // Réaction aux changements
  // (On utilise une fonction réactive $: pour lancer updateDisplay quand les variables changent)
  $: if (selectedCategories || selectedLines || selectedZones) {
    // Petit debounce pour éviter trop d'appels si on clique vite
    // (optionnel, ici on appelle direct pour la réactivité)
    updateDisplay(); 
  }

  // Styles communs
  const checkboxClass = "w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600";
  const labelWrapperClass = "flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm select-none";
  const labelTextClass = "font-medium text-gray-700 dark:text-gray-200";

</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-20">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300 mb-8">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center gap-3">
      <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
        <Route size={24} />
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Répertoire des Lignes</h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Infrastructures, PN et SPI</p>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    
    <section>
      <h3 class="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">1</span>
        Catégories
      </h3>
      <div class="flex flex-wrap gap-3">
        {#each ['Lignes', 'Adresse PN', 'Zone SPI'] as cat}
          <label class={labelWrapperClass}>
            <input type="checkbox" value={cat} bind:group={selectedCategories} class={checkboxClass}>
            <span class={labelTextClass}>{cat}</span>
          </label>
        {/each}
      </div>
    </section>

    {#if selectedCategories.length > 0}
      <section class="animate-in fade-in slide-in-from-top-2 duration-300">
        <h3 class="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">2</span>
          Lignes
        </h3>
        
        {#if isLoadingFilters}
          <div class="flex items-center gap-2 text-gray-500"><Loader2 size={16} class="animate-spin"/> Chargement des lignes...</div>
        {:else if availableLines.length === 0}
          <p class="text-red-500">Aucune ligne trouvée.</p>
        {:else}
          <div class="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
            {#each availableLines as line}
              <label class="{labelWrapperClass} py-1.5 px-3">
                <input type="checkbox" value={line} bind:group={selectedLines} class={checkboxClass}>
                <span class="{labelTextClass} text-sm">{line}</span>
              </label>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if selectedCategories.includes('Zone SPI') && selectedLines.length > 0}
      <section class="animate-in fade-in slide-in-from-top-2 duration-300">
        <h3 class="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">3</span>
          Filtres SPI
        </h3>
        <div class="flex flex-wrap gap-3">
          {#each ['FTY', 'FMS', 'FCR'] as zone}
            <label class={labelWrapperClass}>
              <input type="checkbox" value={zone} bind:group={selectedZones} class={checkboxClass}>
              <span class={labelTextClass}>{zone}</span>
            </label>
          {/each}
        </div>
      </section>
    {/if}

    <hr class="border-gray-200 dark:border-gray-700 my-8">

    <div id="resultDisplay" class="min-h-[200px]">
      
      {#if isLoadingResults}
        <div class="flex justify-center py-20"><Loader2 class="w-10 h-10 text-blue-600 animate-spin" /></div>
      
      {:else if selectedLines.length === 0}
        <div class="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
          <Filter size={48} class="mx-auto mb-3 opacity-50" />
          <p>Veuillez sélectionner au moins une catégorie et une ligne.</p>
        </div>

      {:else}
        {#each selectedLines as line}
          {#if results[line] && (results[line].gares.length > 0 || results[line].pn.length > 0 || results[line].spi.length > 0)}
            
            <div class="mb-10 animate-in fade-in duration-500">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 pb-2 mb-6 flex items-center gap-2">
                <span class="bg-blue-600 text-white px-3 py-1 rounded-lg text-lg shadow-sm">{line}</span>
              </h2>

              {#if results[line].gares.length > 0}
                <div class="mb-6">
                  <h3 class="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Building2 size={18} /> Gares
                  </h3>
                  <div class="flex flex-wrap gap-3">
                    {#each results[line].gares as gare}
                      <div class="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm text-gray-800 dark:text-gray-200 font-medium">
                        {gare.gare}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if results[line].pn.length > 0}
                <div class="mb-6">
                  <h3 class="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <TrainTrack size={18} /> Passages à Niveau
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each results[line].pn as pn}
                      <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
                        <div class="flex justify-between items-center">
                          <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-bold">
                            {pn.pn}
                          </span>
                          <span class="flex items-center gap-1.5 text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                            <Milestone size={14} /> {pn.bk}
                          </span>
                        </div>
                        <div class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
                          <MapPin size={16} class="flex-shrink-0 mt-0.5 opacity-70" />
                          <span>{pn.adresse}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if results[line].spi.length > 0}
                <div class="mb-6">
                  <h3 class="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Tag size={18} /> Zones SPI
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each results[line].spi as spi}
                      <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
                        <div class="flex justify-between items-center">
                          <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-bold">
                            {spi.lieu}
                          </span>
                          <span class="flex items-center gap-1.5 text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                            <Tag size={14} /> {spi.zone}
                          </span>
                        </div>
                        <div class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
                          <MapPin size={16} class="flex-shrink-0 mt-0.5 opacity-70" />
                          <span>{spi.adresse}</span>
                        </div>
                        {#if spi.remarques}
                          <div class="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <Info size={14} class="flex-shrink-0 mt-0.5 text-blue-500" />
                            <span class="italic">{spi.remarques}</span>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

            </div>
          {/if}
        {/each}
      {/if}

    </div>

  </main>
</div>