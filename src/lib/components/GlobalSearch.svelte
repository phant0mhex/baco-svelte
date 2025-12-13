<script>
  import { onMount, tick } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { 
    Search, Loader2, FileText, Users, Tag, Car, Bus, 
    BookUser, Shield, Train, File 
  } from 'lucide-svelte';

  // --- ÉTATS ---
  let isOpen = false;
  let searchTerm = '';
  let results = [];
  let loading = false;
  let selectedIndex = -1;
  let searchTimer;
  let inputElement;
  let resultsContainer;
  
  // Si défini, on est en mode "Sélection" (retourne l'objet au lieu de naviguer)
  let onSelectCallback = null; 

  // --- MAPPING ICÔNES ---
  const iconMap = {
    'contact_repertoire': BookUser,
    'procedure': Shield,
    'client_pmr': Users,
    'ptcar': Tag,
    'taxi': Car,
    'bus': Bus,
    'document': FileText,
    'train': Train
  };

  // --- GESTION OUVERTURE / FERMETURE ---

  function open(callback = null) {
    isOpen = true;
    searchTerm = '';
    results = [];
    selectedIndex = -1;
    onSelectCallback = callback;
    
    // Focus sur l'input après le rendu
    tick().then(() => inputElement?.focus());
  }

  function close() {
    isOpen = false;
    onSelectCallback = null;
  }

  // Écoute des événements globaux (Clavier + Custom Event du Nav)
  function handleWindowKeydown(e) {
    // Raccourci Ctrl+K ou Shift+K
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen ? close() : open();
    }
    // Fermer avec Escape
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  }

  // Écoute de l'événement déclenché par le bouton de la Nav
  onMount(() => {
    const openListener = (e) => open(e.detail?.callback);
    window.addEventListener('openGlobalSearch', openListener);
    
    // Rétro-compatibilité pour les scripts JS existants (window.showGlobalSearch)
    window.showGlobalSearch = (cb) => open(cb);

    return () => {
      window.removeEventListener('openGlobalSearch', openListener);
      delete window.showGlobalSearch;
    };
  });

  // --- LOGIQUE DE RECHERCHE ---

  function handleInput() {
    clearTimeout(searchTimer);
    if (searchTerm.length < 2) {
      results = [];
      loading = false;
      return;
    }
    
    // Debounce 300ms
    searchTimer = setTimeout(executeSearch, 300);
  }

  async function executeSearch() {
    loading = true;
    try {
      const { data, error } = await supabase.rpc('global_search', { search_term: searchTerm });
      if (error) throw error;
      results = data || [];
      selectedIndex = -1; // Réinitialiser la sélection
    } catch (err) {
      console.error('Erreur recherche:', err);
      results = [];
    } finally {
      loading = false;
    }
  }

  // --- NAVIGATION ET SÉLECTION ---

  function handleKeyNav(e) {
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % results.length;
      scrollToSelected();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + results.length) % results.length;
      scrollToSelected();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        selectResult(results[selectedIndex]);
      }
    }
  }

  function scrollToSelected() {
    if (!resultsContainer) return;
    const selectedEl = resultsContainer.children[selectedIndex];
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectResult(result) {
    // Construire l'objet normalisé
    const resultObject = {
      id: result.result_id,
      type: result.result_type_key,
      title: result.title,
      snippet: result.snippet,
      url: result.url
    };

    if (onSelectCallback) {
      // Mode Callback (Liaison)
      onSelectCallback(resultObject);
    } else {
      // Mode Navigation standard
      if (result.result_type_key === 'document') {
        window.open(result.url, '_blank');
      } else {
        goto(result.url); // Navigation SPA SvelteKit
      }
    }
    close();
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if isOpen}
  <div 
    class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-start justify-center p-4 pt-[15vh] z-[1050]"
    on:click|self={close}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-gray-800 text-gray-200 rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden transform transition-all">
      
      <div class="relative flex items-center p-4 border-b border-gray-700">
        <Search class="w-5 h-5 text-gray-400 absolute left-7" />
        
        <input 
          bind:this={inputElement}
          bind:value={searchTerm}
          on:input={handleInput}
          on:keydown={handleKeyNav}
          type="text" 
          placeholder={onSelectCallback ? "Chercher un contenu à lier..." : "Chercher partout..."}
          class="w-full bg-gray-800 border-0 text-lg text-white pl-10 pr-4 py-2 focus:outline-none placeholder-gray-500"
          autocomplete="off"
        >

        {#if loading}
          <Loader2 class="w-5 h-5 text-blue-500 animate-spin absolute right-7" />
        {/if}
      </div>

      <div 
        bind:this={resultsContainer}
        class="p-2 overflow-y-auto max-h-[60vh]"
      >
        {#if searchTerm.length < 2}
          <p class="text-center text-gray-500 p-6">Commencez à taper pour rechercher...</p>
        
        {:else if !loading && results.length === 0}
          <p class="text-center text-gray-500 p-6">Aucun résultat trouvé.</p>
        
        {:else}
          {#each results as result, index}
            <button
              on:click={() => selectResult(result)}
              class="w-full flex items-center justify-between gap-4 p-3 rounded-md cursor-pointer text-left transition-colors {index === selectedIndex ? 'bg-gray-700' : 'hover:bg-gray-700'}"
            >
              <div class="flex items-center gap-4 overflow-hidden">
                <svelte:component 
                  this={iconMap[result.result_type_key] || File} 
                  class="w-5 h-5 text-gray-400 flex-shrink-0" 
                />
                
                <div class="overflow-hidden">
                  <p class="text-base text-white font-medium truncate">
                    {@html result.title} </p>
                  <p class="text-sm text-gray-400 truncate">
                    {@html result.snippet}
                  </p>
                </div>
              </div>
              
              <span class="text-xs text-gray-400 bg-gray-900/50 border border-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">
                {result.result_type}
              </span>
            </button>
          {/each}
        {/if}
      </div>

      <div class="p-2 text-xs text-center text-gray-500 border-t border-gray-700">
        Utilisez <kbd class="font-mono bg-gray-700 border border-gray-600 rounded px-1 text-gray-300">Cmd+K</kbd> pour fermer.
      </div>
    </div>
  </div>
{/if}