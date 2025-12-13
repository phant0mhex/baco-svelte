<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import EasyEditor from '$lib/components/EasyEditor.svelte';
  import { marked } from 'marked';
  import { 
    Pencil, Trash2, Plus, Search, 
    BookOpen, FileText, X, Save 
  } from 'lucide-svelte';

  let procedures = [];
  let categories = [];
  let isLoading = true;
  let searchQuery = "";
  let selectedCategory = "all";
  let isModalOpen = false;
  let isSaving = false;
  let editingProcedure = { id: null, titre: "", categorie: "", contenu: "" };

  onMount(async () => {
    await Promise.all([loadCategories(), loadProcedures()]);
  });

  async function loadCategories() {
    const { data } = await supabase.from('procedures').select('categorie');
    if (data) categories = [...new Set(data.map(p => p.categorie))].sort();
  }

  async function loadProcedures() {
    isLoading = true;
    let query = supabase.from('procedures').select(`*, profiles ( full_name )`).order('titre', { ascending: true });
    if (selectedCategory !== 'all') query = query.eq('categorie', selectedCategory);
    if (searchQuery.trim()) query = query.or(`titre.ilike.%${searchQuery}%,contenu.ilike.%${searchQuery}%`);
    const { data, error } = await query;
    if (!error) procedures = data || [];
    isLoading = false;
  }

  async function saveProcedure() {
    isSaving = true;
    const payload = { titre: editingProcedure.titre, categorie: editingProcedure.categorie, contenu: editingProcedure.contenu, updated_at: new Date() };
    const query = editingProcedure.id ? supabase.from('procedures').update(payload).eq('id', editingProcedure.id) : supabase.from('procedures').insert([payload]);
    const { error } = await query;
    isSaving = false;
    if (error) alert("Erreur : " + error.message);
    else { closeModal(); loadProcedures(); loadCategories(); }
  }

  async function deleteProcedure(id) {
    if (!confirm(`Supprimer cette procédure ?`)) return;
    const { error } = await supabase.from('procedures').delete().eq('id', id);
    if (!error) loadProcedures();
  }

  function openModal(proc = null) {
    editingProcedure = proc ? { ...proc } : { id: null, titre: "", categorie: "", contenu: "" };
    isModalOpen = true;
  }
  function closeModal() { isModalOpen = false; }
</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-10">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
          <BookOpen size={24} />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Base de Connaissances</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Procédures opérationnelles</p>
        </div>
      </div>
      <button on:click={() => openModal()} class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow active:scale-95">
        <Plus size={20} /> <span class="hidden sm:inline">Nouvelle procédure</span>
      </button>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
    
    <aside class="w-full lg:w-64 flex-shrink-0 space-y-6">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Search size={16} /></div>
        <input type="text" placeholder="Rechercher..." bind:value={searchQuery} on:input={loadProcedures} 
          class="block w-full pl-9 pr-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <nav class="space-y-1">
        <h3 class="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Catégories</h3>
        <button on:click={() => { selectedCategory = 'all'; loadProcedures(); }} class="w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all {selectedCategory === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'}">
          Toutes les procédures
        </button>
        {#each categories as cat}
          <button on:click={() => { selectedCategory = cat; loadProcedures(); }} class="w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all {selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'}">
            {cat}
          </button>
        {/each}
      </nav>
    </aside>

    <div class="flex-grow">
      {#if isLoading}
        <div class="flex justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>
      {:else if procedures.length === 0}
        <div class="text-center py-24 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <FileText size={48} class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Aucune procédure</h3>
        </div>
      {:else}
        <div class="space-y-6">
          {#each procedures as proc}
            <div class="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div class="px-8 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <div>
                  <h3 class="text-xl font-bold text-gray-900 dark:text-white">{proc.titre}</h3>
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 mt-2 border border-blue-200 dark:border-blue-800/50">
                    {proc.categorie}
                  </span>
                </div>
                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button on:click={() => openModal(proc)} class="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200"><Pencil size={18} /></button>
                  <button on:click={() => deleteProcedure(proc.id)} class="p-2.5 text-gray-500 hover:text-red-600 hover:bg-white dark:hover:bg-gray-700 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200"><Trash2 size={18} /></button>
                </div>
              </div>
              <div class="px-8 py-8 prose prose-sm max-w-none dark:prose-invert prose-blue prose-headings:font-bold">
                {@html marked(proc.contenu || '')}
              </div>
              <div class="px-8 py-4 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 flex justify-between items-center">
                <span>Mis à jour le {new Date(proc.updated_at || Date.now()).toLocaleDateString()}</span>
                {#if proc.profiles}<span class="flex items-center gap-1.5"><div class="w-2 h-2 rounded-full bg-green-500"></div>{proc.profiles.full_name}</span>{/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>

  {#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" on:click={closeModal}></div>
      <div class="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{editingProcedure.id ? 'Modifier la procédure' : 'Nouvelle procédure'}</h2>
          <button on:click={closeModal} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={24} /></button>
        </div>
        <div class="p-8 overflow-y-auto space-y-6 flex-grow bg-gray-50/50 dark:bg-gray-900/50">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-xs font-extrabold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Titre</label>
              <input type="text" bind:value={editingProcedure.titre} class="block w-full rounded-2xl border-gray-200 bg-white p-4 text-sm font-medium focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm" placeholder="Ex: Procédure d'urgence" />
            </div>
            <div>
              <label class="block text-xs font-extrabold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Catégorie</label>
              <input type="text" list="cats" bind:value={editingProcedure.categorie} class="block w-full rounded-2xl border-gray-200 bg-white p-4 text-sm font-medium focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm" placeholder="Ex: Sécurité" />
              <datalist id="cats">{#each categories as c} <option value={c} /> {/each}</datalist>
            </div>
          </div>
          <div>
            <label class="block text-xs font-extrabold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Contenu</label>
            <div class="editor-container dark-mode-fix rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                <EasyEditor bind:value={editingProcedure.contenu} />
            </div>
          </div>
        </div>
        <div class="px-8 py-5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 z-10">
          <button on:click={closeModal} class="px-6 py-3 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:shadow-sm transition-all">Annuler</button>
          <button on:click={saveProcedure} disabled={isSaving} class="px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform active:scale-95"><Save size={18} /> Enregistrer</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.dark-mode-fix .EasyMDEContainer .CodeMirror) { border: none; border-radius: 0; }
  :global(.dark-mode-fix .editor-toolbar) { border: none; border-bottom: 1px solid #e5e7eb; background-color: #f9fafb; }
  :global([class="dark"] .dark-mode-fix .editor-toolbar) { background-color: #1f2937; border-color: #374151; color: white; }
  :global([class="dark"] .dark-mode-fix .editor-toolbar i) { color: #e5e7eb; }
  :global([class="dark"] .dark-mode-fix .editor-toolbar button:hover) { background-color: #374151; }
</style>