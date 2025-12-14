<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { marked } from 'marked'; // Assurez-vous d'avoir fait: npm install marked
  import { 
    Sparkles, Plus, Trash2, Calendar, User, 
    ArrowLeft, ArrowRight, Loader2, X, Save, 
    Zap, Bug, Star
  } from 'lucide-svelte';

  // --- CONFIG ---
  const ROWS_PER_PAGE = 5;

  // --- ÉTAT ---
  let entries = [];
  let isLoading = true;
  let isSaving = false;
  
  // User & Rôles
  let currentUser = null;
  let canManage = false;

  // Pagination
  let currentPage = 1;
  let totalRows = 0;

  // Modale
  let isModalOpen = false;
  let newEntry = { title: "", type: "Amélioré", content: "" };

  onMount(async () => {
    await loadUserAndRole();
    loadChangelog();
  });

  // --- AUTH ---
  async function loadUserAndRole() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      currentUser = user;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const role = profile?.role || 'user';
      canManage = ['admin', 'moderator'].includes(role);
    }
  }

  // --- CHARGEMENT ---
  async function loadChangelog() {
    isLoading = true;
    try {
      // 1. Compter le total
      const { count, error: countError } = await supabase
        .from('changelog')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      totalRows = count || 0;

      // 2. Récupérer les données
      const from = (currentPage - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('changelog')
        .select(`*, profiles ( full_name, avatar_url )`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      entries = data || [];

    } catch (e) {
      console.error("Erreur chargement:", e);
    } finally {
      isLoading = false;
    }
  }

  // --- ACTIONS ---

  async function saveEntry() {
    if (!newEntry.title || !newEntry.content) return;
    isSaving = true;

    try {
      const payload = {
        title: newEntry.title,
        type: newEntry.type,
        content: newEntry.content, // Markdown brut
        user_id: currentUser.id
      };

      const { error } = await supabase.from('changelog').insert([payload]);
      if (error) throw error;

      closeModal();
      currentPage = 1; // Retour à la première page
      loadChangelog();

    } catch (e) {
      alert("Erreur lors de la publication : " + e.message);
    } finally {
      isSaving = false;
    }
  }

  async function deleteEntry(id) {
    if (!confirm("Supprimer cette entrée ?")) return;
    try {
      const { error } = await supabase.from('changelog').delete().eq('id', id);
      if (error) throw error;
      loadChangelog();
    } catch (e) {
      alert("Erreur suppression : " + e.message);
    }
  }

  // --- UI HELPERS ---

  function openModal() {
    newEntry = { title: "", type: "Amélioré", content: "" };
    isModalOpen = true;
  }
  function closeModal() { isModalOpen = false; }

  function changePage(newPage) {
    const maxPage = Math.ceil(totalRows / ROWS_PER_PAGE) || 1;
    if (newPage < 1 || newPage > maxPage) return;
    currentPage = newPage;
    loadChangelog();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('fr-FR', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
  }

  function getBadgeStyle(type) {
    switch (type) {
      case 'Nouveau': return { 
        class: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800', 
        icon: Star 
      };
      case 'Corrigé': return { 
        class: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800', 
        icon: Bug 
      };
      default: return { 
        class: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800', 
        icon: Zap 
      };
    }
  }

  // Styles CSS
  const inputClass = "block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white p-2.5";
  const labelClass = "block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300";

</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-20">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300">
    <div class="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
          <Sparkles size={24} />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Nouveautés</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Historique des mises à jour</p>
        </div>
      </div>
      
      {#if canManage}
        <button on:click={openModal} class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow active:scale-95 text-sm">
          <Plus size={18} /> <span class="hidden sm:inline">Ajouter</span>
        </button>
      {/if}
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    
    {#if isLoading && entries.length === 0}
      <div class="flex justify-center py-20"><Loader2 class="animate-spin text-blue-500" /></div>
    {:else if entries.length === 0}
      <div class="text-center py-20 text-gray-500 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
        <Sparkles size={48} class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p>Aucune note de mise à jour pour le moment.</p>
      </div>
    {:else}
      
      <div class="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:ml-5 before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
        
        {#each entries as entry}
          {@const style = getBadgeStyle(entry.type)}
          {@const author = entry.profiles}
          
          <div class="relative pl-12 md:pl-12 group animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            <div class="absolute left-0 top-6 w-10 h-10 rounded-full border-4 border-white dark:border-gray-900 bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm z-10">
              <svelte:component this={style.icon} size={18} class={style.class.split(' ')[1]} />
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              
              <div class="p-6 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
                <div class="flex flex-wrap justify-between items-start gap-4 mb-3">
                  <div class="flex items-center gap-3">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider {style.class}">
                      {entry.type}
                    </span>
                    <span class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Calendar size={14} /> {formatDate(entry.created_at)}
                    </span>
                  </div>
                  
                  {#if canManage}
                    <button on:click={() => deleteEntry(entry.id)} class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  {/if}
                </div>
                
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{entry.title}</h2>
                
                <div class="flex items-center gap-2">
                  {#if author?.avatar_url}
                    <img src={author.avatar_url} alt="" class="w-5 h-5 rounded-full object-cover">
                  {:else}
                    <div class="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-500">?</div>
                  {/if}
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Par {author?.full_name || 'Inconnu'}
                  </span>
                </div>
              </div>

              <div class="p-6 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                {@html marked.parse(entry.content || '')}
              </div>

            </div>
          </div>
        {/each}

      </div>

      {#if totalRows > ROWS_PER_PAGE}
        <div class="flex justify-between items-center pt-6 pl-12">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Page {currentPage} / {Math.ceil(totalRows / ROWS_PER_PAGE)}
          </div>
          <div class="flex gap-2">
            <button on:click={() => changePage(currentPage - 1)} disabled={currentPage === 1} class="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ArrowLeft size={20} />
            </button>
            <button on:click={() => changePage(currentPage + 1)} disabled={currentPage * ROWS_PER_PAGE >= totalRows} class="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      {/if}

    {/if}

  </main>

  {#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl border border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Ajouter une entrée</h3>
          <button on:click={closeModal} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full"><X size={20}/></button>
        </div>
        
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class={labelClass}>Titre</label>
              <input type="text" bind:value={newEntry.title} class={inputClass} placeholder="Ex: Version 2.0">
            </div>
            <div>
              <label class={labelClass}>Type</label>
              <select bind:value={newEntry.type} class={inputClass}>
                <option value="Amélioré">Amélioré</option>
                <option value="Nouveau">Nouveau</option>
                <option value="Corrigé">Corrigé</option>
              </select>
            </div>
          </div>
          
          <div>
            <label class={labelClass}>Contenu (Markdown supporté)</label>
            <textarea 
              rows="6" 
              bind:value={newEntry.content} 
              class="{inputClass} font-mono resize-none" 
              placeholder="- Liste des changements..."
            ></textarea>
            <p class="text-xs text-gray-500 mt-1 text-right">Supporte **gras**, *italique*, - listes</p>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button on:click={closeModal} class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-bold">Annuler</button>
          <button on:click={saveEntry} disabled={isSaving} class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {#if isSaving} <Loader2 class="animate-spin" size={16}/> {:else} <Save size={16}/> {/if} Publier
          </button>
        </div>
      </div>
    </div>
  {/if}

</div>