<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { supabase } from '$lib/supabase'; 
  import { goto } from '$app/navigation';
  import { marked } from 'marked'; 
  import { notyf } from '$lib/core/layout'; 
  import { 
    FileText, Search, Plus, Trash2, Pencil, Map, Users, FolderOpen, 
    Wrench, User, Loader2, X, AlertCircle, AlertTriangle, ArrowUpRight,
    History, UserCog, Accessibility, Car, Train, Tag, Database, BookUser, Info, Link as LinkIcon
  } from 'lucide-svelte';

  // --- ÉTAT ---
  let isLoading = true;
  let isSaving = false;
  let procedures = [];
  let categories = [];
  let currentUserId = null;
  let userRole = 'user';

  // Filtres
  let selectedCategory = 'all';
  let searchTerm = '';

  // Modale
  let isModalOpen = false;
  let currentProcedureId = null;
  let isEditMode = false;

  // Formulaire
  let formTitle = '';
  let formCategory = '';
  let EasyMDEComponent; 
  let easyMDEInstance;
  let modalContenu; 
  let currentLinks = [];
  
  // Historique (Admin)
  let showHistory = false;
  let procedureVersions = [];
  
  // --- Computed State ---
  $: canManage = ['admin', 'moderator'].includes(userRole);

  // --- EASYMDE INITIALIZATION (CORRIGÉ : Ajout de setTimeout et refresh) ---
  async function initEasyMDE(content = '') {
      // 1. Importation dynamique (SSR safe)
      if (typeof EasyMDEComponent === 'undefined') {
          try {
              const module = await import('easymde');
              EasyMDEComponent = module.default;
          } catch (e) {
              console.error("Erreur de chargement dynamique d'EasyMDE:", e);
              return;
          }
      }
      
      if (!modalContenu) return;

      // 2. Détruire l'ancienne instance
      if (easyMDEInstance) {
          easyMDEInstance.toTextArea();
          easyMDEInstance = null;
      }

      // 3. Créer la nouvelle instance
      try {
          easyMDEInstance = new EasyMDEComponent({
              element: modalContenu,
              initialValue: content, 
              spellChecker: false,
              status: false,
              // Utiliser une toolbar de base pour éviter les problèmes de caractères spéciaux
              toolbar: ["bold", "italic", "|", "heading", "unordered-list", "ordered-list", "|", "link", "preview", "fullscreen", "guide"], 
              minHeight: "150px"
          });
          
          // CRITICAL FIX: Retarder le refresh pour garantir la visibilité du CodeMirror
          setTimeout(() => {
              if (easyMDEInstance && easyMDEInstance.codemirror) {
                 easyMDEInstance.codemirror.refresh();
              }
          }, 50); // Délai de 50ms pour la stabilisation DOM
          
      } catch (e) {
          console.error("Erreur initialisation EasyMDE:", e);
      }
  }


  // --- LIFECYCLE ---
  onMount(async () => {
    // 1. Auth & Rôles
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return goto('/index');
    currentUserId = user.id;

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    userRole = profile?.role || 'user';
    
    // 2. Configuration Marked.js
    if (typeof marked !== 'undefined') {
      const renderer = new marked.Renderer();
      renderer.link = (href, title, text) => `<a href="${href}" ${title ? `title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text || href}</a>`;
      marked.setOptions({ renderer: renderer });
    }

    // 3. Chargement initial
    await Promise.all([loadCategories(), loadProcedures()]);
    isLoading = false;
  });

  onDestroy(() => {
    if (easyMDEInstance) {
      easyMDEInstance.toTextArea();
      easyMDEInstance = null;
    }
  });

  // --- DATA LOADING ---

  async function loadCategories() {
    const { data } = await supabase.from('procedures').select('categorie');
    if (data) {
      categories = [...new Set(data.map(p => p.categorie))].sort();
    }
  }

  async function fetchLinkedContent(procedureId) {
    const { data } = await supabase.rpc('get_linked_content', {
      p_source_type: 'procedure',
      p_source_id: procedureId.toString()
    });
    return data || [];
  }

  async function loadProcedures() {
    isLoading = true;
    try {
      let query = supabase.from('procedures')
        .select(`*, updated_at, profiles ( full_name )`)
        .order('titre', { ascending: true });

      if (selectedCategory !== 'all') {
        query = query.eq('categorie', selectedCategory);
      }
      if (searchTerm) {
        query = query.or(`titre.ilike.%${searchTerm}%,contenu.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      let loadedProcedures = data || [];
      
      loadedProcedures = await Promise.all(loadedProcedures.map(async p => {
          p.links = await fetchLinkedContent(p.id);
          return p;
      }));
      
      procedures = loadedProcedures;
      
    } catch (error) {
      notyf.error('Erreur chargement: ' + error.message);
    } finally {
      isLoading = false;
    }
  }
  
  // Fonction pour charger les liens dans l'état de la modale
  async function loadModalLinks(procedureId) {
    currentLinks = await fetchLinkedContent(procedureId);
  }


  // --- MODAL & FORM ---

  async function openModal(entry = null) {
    isEditMode = entry !== null;
    currentProcedureId = isEditMode ? entry.id : null;
    formTitle = isEditMode ? entry.titre : '';
    formCategory = isEditMode ? entry.categorie : '';
    
    const content = isEditMode ? entry.contenu : '';
    currentLinks = [];
    procedureVersions = [];
    showHistory = false;

    // 1. Ouvrir la modale et attendre le montage DOM
    isModalOpen = true; 
    await tick(); 

    // 2. Initialisation EasyMDE APRES l'ouverture de la modale
    await initEasyMDE(content); 
    
    // 3. Charger les données spécifiques à l'édition
    if (isEditMode) {
      await loadModalLinks(entry.id);
      if (canManage) await loadHistory(entry.id);
      showHistory = canManage;
    }
  }
  
  function closeModal() {
    // Nettoyer EasyMDE
    if (easyMDEInstance) {
      easyMDEInstance.toTextArea();
      easyMDEInstance = null;
    }
    isModalOpen = false;
    currentLinks = [];
    procedureVersions = [];
  }

  // --- ACTIONS DE LIEN ---
  function handleAddLinkClick() {
    if (typeof window.showGlobalSearch === 'function') {
      window.showGlobalSearch((result) => {
        const alreadyExists = currentLinks.some(link => link.id === result.id && link.type === result.type);
        if (alreadyExists) {
          notyf.error("Ce lien existe déjà.");
          return;
        }
        currentLinks = [...currentLinks, result];
      });
    } else {
      notyf.error("La recherche globale (Ctrl+K) n'est pas initialisée. (Besoin de GlobalSearch.js)");
    }
  }

  function removeLink(index) {
    currentLinks.splice(index, 1);
    currentLinks = currentLinks; 
  }

  // --- ADMIN ACTIONS ---
  
  async function handleFormSubmit() {
    if (!formTitle || !formCategory) {
      notyf.error("Le titre et la catégorie sont requis.");
      return;
    }
    
    isSaving = true;
    // Récupérer la valeur de EasyMDE ou du textarea
    const contenu = easyMDEInstance ? easyMDEInstance.value() : modalContenu?.value || '';
    const entryData = { titre: formTitle, categorie: formCategory, contenu: contenu, user_id: currentUserId };

    try {
      let savedProcedureId = currentProcedureId;

      if (isEditMode) {
        const { error: updateError } = await supabase.from('procedures').update(entryData).eq('id', currentProcedureId);
        if (updateError) throw updateError;
      } else {
        const { data: newData, error: insertError } = await supabase.from('procedures').insert([entryData]).select('id').single();
        if (insertError) throw insertError;
        savedProcedureId = newData.id;
      }
      
      // GESTION DES LIENS
      if (savedProcedureId) {
        await supabase.from('liaisons_contenu')
          .delete()
          .eq('source_content_type', 'procedure')
          .eq('source_content_id', savedProcedureId);
      }
          
      if (currentLinks.length > 0) {
          const linksToInsert = currentLinks.map(link => ({
              source_content_type: 'procedure',
              source_content_id: savedProcedureId.toString(),
              target_content_type: link.type,
              target_content_id: link.id.toString(),
              created_by: currentUserId
          }));
          const { error: linksError } = await supabase.from('liaisons_contenu').insert(linksToInsert);
          if (linksError) throw linksError;
      }

      notyf.success(isEditMode ? "Procédure mise à jour !" : "Procédure ajoutée !");
      closeModal();
      loadProcedures();

    } catch (error) {
      notyf.error("Erreur: " + error.message);
    } finally {
      isSaving = false;
    }
  }

  async function deleteProcedure(id, titre) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la procédure "${titre}" ?`)) return;
    try {
      await supabase.from('liaisons_contenu').delete().eq('source_content_id', id.toString());
      const { error } = await supabase.from('procedures').delete().eq('id', id);
      if (error) throw error;
      notyf.success("Procédure supprimée !");
      loadProcedures();
    } catch (error) {
      notyf.error("Erreur: " + error.message);
    }
  }
  
  async function loadHistory(procedureId) {
    const { data } = await supabase.from('procedure_versions')
      .select(`*, profiles:modified_by ( full_name )`)
      .eq('procedure_id', procedureId)
      .order('archived_at', { ascending: false });
    procedureVersions = data || [];
  }
  
  function restoreVersion(content) {
    if(!confirm("Attention : Le contenu actuel de l'éditeur sera remplacé. Continuer ?")) return;
    if (easyMDEInstance) {
      easyMDEInstance.value(content);
    } else if (modalContenu) {
      modalContenu.value = content;
    }
    notyf.success("Version restaurée (pensez à enregistrer).");
  }

  // --- UI HELPERS ---
  
  function highlightText(text, term) {
    if (!term || !text) return text;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-700/50 rounded px-0.5">$1</mark>');
  }
  
  function formatTraceabilityDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  }

  function getLinkIcon(type) {
    if (type && type.includes('document')) return FolderOpen;
    if (type && type.includes('pmr')) return Accessibility;
    if (type && type.includes('taxi')) return Car;
    if (type && type.includes('bus')) return Train;
    if (type && type.includes('repertoire')) return BookUser;
    return Info;
  }
  
  const inputClass = "w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-10">
  
  <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="container mx-auto p-6 md:flex md:justify-between md:items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100">Base de Connaissances</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Procédures, fiches réflexes et informations opérationnelles.</p>
      </div>
      <div class="mt-4 md:mt-0" class:admin-only={!canManage}>
        <button on:click={() => openModal()} class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">
          <Plus size={20} />
          <span>Ajouter une procédure</span>
        </button>
      </div>
    </div>
  </header>

  <div class="container mx-auto p-8">
    <div class="flex flex-col md:flex-row gap-8">
      
      <aside class="w-full md:w-1/4">
        <div class="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <label for="search-bar" class={labelClass}>Rechercher</label>
          <div class="relative mt-1">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={20} class="w-5 h-5 text-gray-400"/>
            </div>
            <input type="search" id="search-bar" bind:value={searchTerm} on:input={loadProcedures} placeholder="Incident, gare, L96..." 
                   class="{inputClass} pl-10 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400">
          </div>
        </div>
        
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Catégories</h3>
          <div id="categories-list" class="space-y-2">
            <button on:click={() => selectedCategory = 'all'} class="w-full text-left px-3 py-2 rounded-md font-medium text-sm {selectedCategory === 'all' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}">
              Toutes les catégories
            </button>
            {#each categories as cat}
              <button on:click={() => selectedCategory = cat} class="w-full text-left px-3 py-2 rounded-md font-medium text-sm {selectedCategory === cat ? 'bg-blue-100 text-blue-700' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}">
                {cat}
              </button>
            {/each}
          </div>
        </div>
      </aside>

      <main class="flex-1 space-y-6" id="procedures-list">
        {#if isLoading}
          <div class="flex justify-center items-center py-20"><Loader2 size={40} class="w-10 h-10 text-blue-600 animate-spin"/></div>
        {:else if procedures.length === 0}
          <div class="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
            <FileText size={48} class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"/>
            <h3 class="mt-4 text-xl font-semibold text-gray-800 dark:text-gray-100">Aucune procédure</h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Aucun document ne correspond à vos filtres.</p>
          </div>
        {:else}
          {#each procedures as entry (entry.id)}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm flex flex-col hover:shadow-md transition-shadow">
              
              <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700/50">
                <div>
                  <h3 class="text-xl font-bold text-blue-700 dark:text-blue-400">{@html highlightText(entry.titre, searchTerm)}</h3>
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{@html highlightText(entry.categorie, searchTerm)}</span>
                </div>
                
                <div class:admin-only={!canManage} class="flex items-center flex-shrink-0 gap-2">
                  {#if canManage}
                    <button on:click={() => deleteProcedure(entry.id, entry.titre)} class="p-2 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                    <button on:click={() => openModal(entry)} class="p-2 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/20" title="Modifier">
                      <Pencil size={16} />
                    </button>
                  {/if}
                </div>
              </div>
              
              <div class="p-4 prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-300">
                {@html marked.parse(entry.contenu || '')}
              </div>
              
              {#if entry.links && entry.links.length > 0}
                <div class="p-4 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <LinkIcon size={16} class="text-gray-500 dark:text-gray-400" /> Contenus Liés
                  </h4>
                  <div class="flex flex-wrap gap-2">
                      {#each entry.links as link}
                        <a href={link.url || '#'} target="_blank" rel="noopener noreferrer"
                           class="flex items-center gap-2 text-xs font-medium px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            <svelte:component this={getLinkIcon(link.type)} size={12} />
                            <span>{link.title}</span>
                            <ArrowUpRight size={12} class="text-gray-500 dark:text-gray-400"/>
                        </a>
                      {/each}
                  </div>
                </div>
              {/if}
              
              {#if entry.updated_at && entry.profiles}
                <div class="p-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                  <p class="text-xs text-gray-500 dark:text-gray-400 italic">
                    Dernière modification par {entry.profiles.full_name || 'Utilisateur'} {formatTraceabilityDate(entry.updated_at)}
                  </p>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </main>
      
    </div>
  </div>

  {#if isModalOpen}
    <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[55] animate-in fade-in duration-300">
      <div on:click|self={closeModal} class="absolute inset-0"></div>
      
      <div id="procedure-modal-panel" class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl transform transition-all duration-300 ease-out border border-gray-200 dark:border-gray-700">
        <form on:submit|preventDefault={handleFormSubmit} id="procedure-form">
          
          <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 id="modal-title" class="text-xl font-semibold text-gray-800 dark:text-gray-100">{isEditMode ? 'Modifier' : 'Ajouter'} une procédure</h3>
            <button type="button" on:click={closeModal} class="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20}/></button>
          </div>
          
          <div id="modal-scroll-container" class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <input type="hidden" id="modal-procedure-id" bind:value={currentProcedureId}>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="modal-titre" class={labelClass}>Titre</label>
                <input type="text" id="modal-titre" bind:value={formTitle} required class={inputClass}>
              </div>
              <div>
                <label for="modal-categorie" class={labelClass}>Catégorie</label>
                <input type="text" id="modal-categorie" bind:value={formCategory} required placeholder="Ex: Incidents, Sécurité..." class={inputClass}>
              </div>
            </div>
            
            <div>
              <label for="modal-contenu" class={labelClass}>Contenu (Markdown)</label>
              <textarea id="modal-contenu" bind:this={modalContenu} class="w-full h-40"></textarea>
            </div>

            {#if isEditMode}
              {#if showHistory}
                <div id="history-container" class="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div class="flex items-center gap-2 mb-2">
                    <History size={16} class="text-gray-500"/>
                    <h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide">Historique des versions</h4>
                  </div>
                  {#if procedureVersions.length > 0}
                    <div class="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {#each procedureVersions as version}
                        <div class="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                          <span class="text-gray-600 dark:text-gray-300 truncate max-w-xs">
                            {formatTraceabilityDate(version.archived_at)} par {version.profiles?.full_name || 'Inconnu'}
                          </span>
                          <button type="button" on:click={() => restoreVersion(version.contenu)} class="text-blue-600 hover:underline font-medium ml-2">
                            Restaurer
                          </button>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-xs text-gray-400 italic">Aucune version antérieure.</p>
                  {/if}
                </div>
              {/if}

              <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div class="flex justify-between items-center mb-2">
                  <label class={labelClass}>Contenus Liés (Documents, Taxis, PMR...)</label>
                  <button type="button" on:click={handleAddLinkClick} id="add-link-button" class="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md hover:bg-blue-200">
                    <Plus size={16} /> Ajouter un lien
                  </button>
                </div>
                <div id="modal-links-list" class="space-y-2">
                  {#if currentLinks.length === 0}
                    <p class="text-sm text-gray-400 text-center p-2">Aucun lien.</p>
                  {:else}
                    <div class="flex flex-wrap gap-2">
                      {#each currentLinks as link, index}
                        <div class="flex items-center gap-2 text-xs font-medium px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-600"
                             title="{link.snippet || link.title}">
                          <svelte:component this={getLinkIcon(link.type)} size={12} />
                          <span>{link.title}</span>
                          <button type="button" on:click={() => removeLink(index)} class="p-0.5 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20">
                             <X size={12} />
                          </button>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
            
          </div>
          
          <div id="modal-footer" class="flex justify-end items-center p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
            <button type="button" on:click={closeModal} class="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none">
              Annuler
            </button>
            <button type="submit" disabled={isSaving} class="ml-3 px-4 py-2 bg-blue-600 text-white border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none disabled:opacity-50">
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
       
        </form>
      </div>
    </div>
  {/if}
  
</div>