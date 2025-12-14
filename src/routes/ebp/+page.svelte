<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Database, Search, ChevronLeft, ChevronRight, Loader2
  } from 'lucide-svelte';

  // --- CONFIG ---
  const ROWS_PER_PAGE = 15;

  // --- ÉTAT ---
  let ebpData = [];
  let isLoading = true;
  
  // Pagination & Recherche
  let searchQuery = "";
  let searchTimer;
  let currentPage = 1;
  let totalRows = 0;

  onMount(() => {
    loadData();
  });

  // --- LOGIQUE MÉTIER ---

  function handleSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentPage = 1; 
      loadData();
    }, 300);
  }

  function changePage(newPage) {
    const maxPage = Math.ceil(totalRows / ROWS_PER_PAGE) || 1;
    if (newPage < 1 || newPage > maxPage) return;
    currentPage = newPage;
    loadData();
    // Scroll fluide vers le haut du tableau
    const table = document.getElementById('result-table');
    if(table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadData() {
    isLoading = true;
    try {
      const from = (currentPage - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;

      // 1. Requête principale
      let query = supabase
        .from('ebp')
        .select('Lignes, PtCar, Abbr, Vue_EBP', { count: 'exact' })
        .order('PtCar', { ascending: true })
        .range(from, to);

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        // Filtre "OR" sur les 4 colonnes
        query = query.or(`Lignes.ilike.%${q}%,PtCar.ilike.%${q}%,Abbr.ilike.%${q}%,Vue_EBP.ilike.%${q}%`);
      }

      const { data, count, error } = await query;
      
      if (error) throw error;

      ebpData = data || [];
      totalRows = count || 0;

    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      isLoading = false;
    }
  }

  // --- HELPERS UI ---
  $: fromRow = (currentPage - 1) * ROWS_PER_PAGE + 1;
  $: toRow = Math.min(currentPage * ROWS_PER_PAGE, totalRows);

</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-10">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300">
    <div class="max-w-6xl mx-auto px-6 h-20 flex items-center gap-3">
      <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
        <Database size={24} />
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Répertoire des Données EBP</h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Lignes, PtCar, Abréviations et Vues EBP</p>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
    
    <div class="max-w-xl mx-auto">
      <div class="relative group">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="Rechercher (ex: 90, Acren, FXA...)" 
          bind:value={searchQuery}
          on:input={handleSearchInput}
          class="block w-full pl-10 pr-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm text-gray-900 dark:text-white"
        />
      </div>
    </div>

    <div id="result-table">
      {#if isLoading}
        <div class="flex flex-col items-center justify-center py-20 text-gray-400">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p>Chargement...</p>
        </div>
      
      {:else if ebpData.length === 0}
        <div class="text-center py-24 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Database size={48} class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Aucun résultat</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Aucune donnée EBP ne correspond à votre recherche.</p>
        </div>

      {:else}
        <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
                <tr>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">Lignes</th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">PtCar</th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">Abréviation</th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">Vue EBP</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white dark:bg-gray-800">
                {#each ebpData as row}
                  <tr class="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-150">
                    
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {row.Lignes || '—'}
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold">
                      {row.PtCar || '—'}
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if row.Abbr}
                        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 font-mono">
                          {row.Abbr}
                        </span>
                      {:else}
                        <span class="text-gray-300 dark:text-gray-600">—</span>
                      {/if}
                    </td>

                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {row.Vue_EBP || '—'}
                    </td>

                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-center justify-between mt-8 border-t border-gray-200 dark:border-gray-700 pt-6 gap-4">
          
          <div class="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 shadow-sm">
            Données <span class="font-bold text-gray-900 dark:text-white">{totalRows > 0 ? fromRow : 0}</span> à <span class="font-bold text-gray-900 dark:text-white">{toRow}</span> sur
            <span class="font-bold text-gray-900 dark:text-white">{totalRows}</span>
          </div>

          <div class="flex gap-2">
            <button 
              on:click={() => changePage(currentPage - 1)} 
              disabled={currentPage === 1}
              class="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} /> Précédent
            </button>
            <button 
              on:click={() => changePage(currentPage + 1)} 
              disabled={currentPage >= Math.ceil(totalRows / ROWS_PER_PAGE)}
              class="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </div>

      {/if}
    </div>

  </main>
</div>