<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { 
    FileClock, Search, Filter, Calendar, User, 
    PlusCircle, Pencil, Trash2, Shield, LogIn, Info, 
    Loader2, RefreshCw, ChevronDown, ChevronUp, Database
  } from 'lucide-svelte';

  // --- CONFIG ---
  const ROWS_PER_PAGE = 25;

  // --- ÉTAT ---
  let logs = [];
  let users = [];
  let isLoading = true;
  let hasMore = true;
  let currentPage = 0;
  
  // Gestion de l'affichage des détails (JSON)
  let expandedRows = new Set();

  // Filtres
  let filters = {
    search: "",
    action: "all",
    table: "all",
    userId: "all",
    dateStart: ""
  };

  let uniqueTables = [];

  onMount(async () => {
    await checkAdminAccess();
    await loadUsersList();
    loadLogs(true);
  });

  // --- SÉCURITÉ ---
  async function checkAdminAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return goto('/');
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      goto('/');
    }
  }

  // --- CHARGEMENT ---

  async function loadUsersList() {
    // CORRECTION : Retrait de 'email' qui n'existe pas dans public.profiles
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
    if (data) users = data;
  }

  async function loadLogs(reset = false) {
    if (reset) {
      logs = [];
      currentPage = 0;
      hasMore = true;
      expandedRows = new Set();
    }
    
    isLoading = true;
    const from = currentPage * ROWS_PER_PAGE;
    const to = from + ROWS_PER_PAGE - 1;

    // CORRECTION : Retrait de 'email' dans la jointure profiles
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        profiles ( full_name, avatar_url )
      `)
      .order('timestamp', { ascending: false })
      .range(from, to);

    // Filtres
    if (filters.search) query = query.or(`record_id.ilike.%${filters.search}%,changes.ilike.%${filters.search}%`);
    if (filters.action !== 'all') query = query.eq('action_type', filters.action);
    if (filters.table !== 'all') query = query.eq('table_name', filters.table);
    if (filters.userId !== 'all') query = query.eq('user_id', filters.userId);
    if (filters.dateStart) query = query.gte('timestamp', `${filters.dateStart}T00:00:00`);

    const { data, error } = await query;

    if (error) {
      console.error("Erreur logs:", error);
    } else {
      if (data.length < ROWS_PER_PAGE) hasMore = false;
      
      logs = reset ? data : [...logs, ...data];
      
      // Extraction des tables uniques pour le filtre
      const tables = new Set([...uniqueTables, ...data.map(l => l.table_name)]);
      uniqueTables = Array.from(tables).sort();
      
      currentPage++;
    }
    isLoading = false;
  }

  // --- UI HELPERS ---

  function toggleDetails(id) {
    if (expandedRows.has(id)) {
      expandedRows.delete(id);
    } else {
      expandedRows.add(id);
    }
    expandedRows = new Set(expandedRows);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('fr-BE', { 
      day: '2-digit', month: '2-digit', year: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function getActionStyle(action) {
    if (!action) return {};
    const a = action.toUpperCase();
    
    if (a === 'INSERT') return { 
      class: 'border bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800',
      icon: PlusCircle, label: 'Ajout'
    };
    if (a === 'UPDATE') return { 
      class: 'border bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800',
      icon: Pencil, label: 'Modif'
    };
    if (a === 'DELETE') return { 
      class: 'border bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800',
      icon: Trash2, label: 'Suppr'
    };
    
    return { 
      class: 'border bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      icon: Info, label: a
    };
  }

  function formatJSON(json) {
    try {
      if (typeof json === 'string') return json;
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return json;
    }
  }

  // Styles CSS
  const selectClass = "block w-full rounded-xl border-gray-200 bg-white dark:bg-gray-700 border dark:border-gray-600 text-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white p-2.5 shadow-sm";
  const inputClass = "block w-full rounded-xl border-gray-200 bg-white dark:bg-gray-700 border dark:border-gray-600 text-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white p-2.5 shadow-sm";
  const labelClass = "block text-xs font-extrabold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide";

</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-10">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
          <FileClock size={24} />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Audit Logs</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Historique des modifications système</p>
        </div>
      </div>
      <button on:click={() => loadLogs(true)} class="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all" title="Rafraîchir">
        <RefreshCw size={20} class={isLoading ? "animate-spin" : ""} />
      </button>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    
    <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        
        <div class="lg:col-span-2">
          <label class={labelClass}>Recherche (ID / Contenu)</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Search size={16} /></div>
            <input type="text" bind:value={filters.search} on:change={() => loadLogs(true)} placeholder="Ex: 492, Walcourt..." class="{inputClass} pl-9" />
          </div>
        </div>

        <div>
          <label class={labelClass}>Action</label>
          <select bind:value={filters.action} on:change={() => loadLogs(true)} class={selectClass}>
            <option value="all">Toutes</option>
            <option value="INSERT">Ajout</option>
            <option value="UPDATE">Modification</option>
            <option value="DELETE">Suppression</option>
          </select>
        </div>

        <div>
          <label class={labelClass}>Table</label>
          <select bind:value={filters.table} on:change={() => loadLogs(true)} class={selectClass}>
            <option value="all">Toutes</option>
            {#each uniqueTables as t}
              <option value={t}>{t}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class={labelClass}>Utilisateur</label>
          <select bind:value={filters.userId} on:change={() => loadLogs(true)} class={selectClass}>
            <option value="all">Tous</option>
            {#each users as u}
              <option value={u.id}>{u.full_name || 'Utilisateur inconnu'}</option>
            {/each}
          </select>
        </div>

      </div>
    </div>

    <div class="space-y-4">
      {#if isLoading && logs.length === 0}
        <div class="flex justify-center py-20"><Loader2 class="animate-spin text-blue-500" /></div>
      {:else if logs.length === 0}
        <div class="text-center py-20 text-gray-500 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">Aucun historique trouvé.</div>
      {:else}
        {#each logs as log}
          {@const style = getActionStyle(log.action_type)}
          
          <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            
            <div 
              class="flex flex-wrap md:flex-nowrap items-center justify-between p-4 gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              on:click={() => toggleDetails(log.id)}
            >
              
              <div class="flex items-center gap-4 min-w-[200px]">
                <div class="flex-shrink-0">
                  {#if log.profiles?.avatar_url}
                    <img src={log.profiles.avatar_url} alt="" class="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600">
                  {:else}
                    <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                      {log.profiles?.full_name?.[0] || '?'}
                    </div>
                  {/if}
                </div>
                <div>
                  <p class="text-sm font-bold text-gray-900 dark:text-white">{log.profiles?.full_name || 'Utilisateur inconnu'}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatDate(log.timestamp)}</p>
                </div>
              </div>

              <div class="flex items-center gap-3 flex-grow">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold {style.class}">
                  <svelte:component this={style.icon} size={14} />
                  {style.label}
                </span>
                <span class="text-gray-400 dark:text-gray-600">sur</span>
                <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-300">
                  <Database size={12} /> {log.table_name}
                </span>
                <span class="text-xs text-gray-400 font-mono">#{log.record_id}</span>
              </div>

              <div class="text-gray-400">
                {#if expandedRows.has(log.id)} <ChevronUp size={20}/> {:else} <ChevronDown size={20}/> {/if}
              </div>
            </div>

            {#if expandedRows.has(log.id)}
              <div class="bg-gray-50 dark:bg-black/20 border-t border-gray-200 dark:border-gray-700 p-4 animate-in slide-in-from-top-2 duration-200">
                <h4 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Détails des modifications</h4>
                <div class="bg-gray-100 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                  <pre class="text-xs font-mono text-gray-700 dark:text-blue-200 whitespace-pre-wrap">{formatJSON(log.changes)}</pre>
                </div>
              </div>
            {/if}

          </div>
        {/each}
      {/if}

      {#if hasMore}
        <div class="flex justify-center pt-6">
          <button on:click={() => loadLogs()} disabled={isLoading} class="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-bold text-gray-600 dark:text-gray-300 shadow-sm hover:shadow hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center gap-2">
            {#if isLoading} <Loader2 size={16} class="animate-spin"/> Chargement... {:else} Charger plus d'historique {/if}
          </button>
        </div>
      {/if}
    </div>

  </main>
</div>