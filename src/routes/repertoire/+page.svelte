<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Search, User, Phone, Mail, LayoutGrid, List, 
    ArrowDownAZ, ArrowDownZA, Plus, FileText, 
    Pencil, Trash2, ChevronDown, CheckSquare, Square, 
    Loader2, FolderOpen, UserX
  } from 'lucide-svelte';
  
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';
  import * as XLSX from 'xlsx';

  // --- ÉTATS ---
  let user = null;
  let isAdmin = false;

  // Données
  let allContacts = [];
  let displayedContacts = {}; // { "Groupe A": [c1, c2], "Groupe B": [] }
  let categories = [];
  let zones = [];
  
  // Filtres
  let selectedCategories = [];
  let selectedZones = [];
  let searchTerm = "";
  let sortOrder = 'az'; // 'az' ou 'za'
  let viewMode = 'grid'; // 'grid' ou 'list'

  // UI
  let loading = false;
  let loadingCategories = true;
  let showZoneFilters = false;
  
  // Modale
  let showModal = false;
  let modalLoading = false;
  let isEditMode = false;
  let modalForm = {
    id: null,
    nom: '',
    tel: '',
    email: '',
    categorie: '',
    zone: '',
    groupe: ''
  };

  // Groupes ouverts (pour l'accordéon en mode grille)
  let openGroups = {};

  onMount(async () => {
    // 1. Auth & Prefs
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      isAdmin = data?.role === 'admin';
    }
    
    if (localStorage.getItem('baco-repertoire-view')) {
        viewMode = localStorage.getItem('baco-repertoire-view');
    }

    // 2. Charger les filtres initiaux
    await loadCategories();
  });

  // --- LOGIQUE DE CHARGEMENT ---

  async function loadCategories() {
    loadingCategories = true;
    const { data } = await supabase.from('contacts_repertoire').select('categorie_principale');
    if (data) {
      categories = [...new Set(data.map(i => i.categorie_principale))].filter(Boolean).sort();
    }
    loadingCategories = false;
  }

  // Réagir aux changements de filtres
  $: if (selectedCategories) handleCategoryChange();
  $: if (selectedCategories || selectedZones || searchTerm || sortOrder) loadContacts();

  async function handleCategoryChange() {
    const zonable = ['MIA', 'DSE'];
    const needsZones = selectedCategories.some(cat => zonable.includes(cat));
    
    if (needsZones && !showZoneFilters) {
      showZoneFilters = true;
      // Charger les zones si pas encore fait
      if (zones.length === 0) {
        const { data } = await supabase.from('contacts_repertoire').select('zone').in('categorie_principale', zonable);
        zones = [...new Set(data.map(i => i.zone))].filter(Boolean).sort();
      }
    } else if (!needsZones) {
      showZoneFilters = false;
      selectedZones = []; // Reset zones si on décoche MIA/DSE
    }
  }

  async function loadContacts() {
    // Ne rien charger si aucun filtre
    if (selectedCategories.length === 0 && !searchTerm) {
        displayedContacts = {};
        return;
    }

    loading = true;
    let query = supabase
        .from('contacts_repertoire')
        .select('*')
        .order('nom', { ascending: sortOrder === 'az' });

    // Construction complexe du filtre OR (fidèle au JS original)
    const orFilters = [];
    const zonable = ['MIA', 'DSE'];
    
    const catsWithZones = selectedCategories.filter(c => zonable.includes(c));
    const catsWithoutZones = selectedCategories.filter(c => !zonable.includes(c));

    // 1. Catégories sans zones (simple)
    catsWithoutZones.forEach(cat => orFilters.push(`categorie_principale.eq.${cat}`));

    // 2. Catégories avec zones
    if (catsWithZones.length > 0) {
      if (selectedZones.length > 0) {
        selectedZones.forEach(zone => {
          if (zone === 'FTY') {
             // Cas spécifique FTY (reproduit du script original)
             if (catsWithZones.includes('MIA')) orFilters.push(`and(categorie_principale.eq.MIA,zone.eq.FTY),and(categorie_principale.eq.MIA,zone.eq.FMS,groupe.eq.TL/MPI)`);
             if (catsWithZones.includes('DSE')) orFilters.push(`and(categorie_principale.eq.DSE,zone.eq.FTY)`);
          } else {
             catsWithZones.forEach(cat => orFilters.push(`and(categorie_principale.eq.${cat},zone.eq.${zone})`));
          }
        });
      } else {
        // Si aucune zone cochée mais MIA/DSE coché -> tout prendre pour cette cat
        catsWithZones.forEach(cat => orFilters.push(`categorie_principale.eq.${cat}`));
      }
    }

    // Appliquer filtres
    if (orFilters.length > 0) query = query.or(orFilters.join(','));
    
    // Recherche textuelle
    if (searchTerm) {
      query = query.or(`nom.ilike.%${searchTerm}%,tel.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,groupe.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }

    // Grouper les résultats
    const groups = {};
    (data || []).forEach(c => {
        const g = c.groupe || 'Autre';
        if (!groups[g]) {
            groups[g] = [];
            openGroups[g] = true; // Ouvrir par défaut
        }
        groups[g].push(c);
    });

    displayedContacts = groups;
    loading = false;
  }

  // --- UI HELPERS ---

  function toggleCategory(cat) {
    if (selectedCategories.includes(cat)) {
        selectedCategories = selectedCategories.filter(c => c !== cat);
    } else {
        selectedCategories = [...selectedCategories, cat];
    }
  }

  function toggleZone(zone) {
    if (selectedZones.includes(zone)) {
        selectedZones = selectedZones.filter(z => z !== zone);
    } else {
        selectedZones = [...selectedZones, zone];
    }
  }

  function switchView(mode) {
    viewMode = mode;
    localStorage.setItem('baco-repertoire-view', mode);
  }

  function toggleGroupAccordion(groupName) {
    openGroups[groupName] = !openGroups[groupName];
  }

  const cleanPhone = (tel) => tel ? tel.replace(/[^0-9]/g, '') : '';
  const formatPhone = (tel) => {
      if(!tel) return '';
      const cleaned = cleanPhone(tel);
      // Format simple 04XX/XX.XX.XX ou 0X/XXX.XX.XX
      if (cleaned.length >= 10) {
          return cleaned.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1/$2.$3.$4'); 
      }
      return tel;
  };

  // --- MODALE ---

  function openModal(contact = null) {
    isEditMode = !!contact;
    modalForm = {
      id: contact?.id || null,
      nom: contact?.nom || '',
      tel: contact?.tel || '',
      email: contact?.email || '',
      categorie: contact?.categorie_principale || '',
      zone: contact?.zone || '',
      groupe: contact?.groupe || ''
    };
    showModal = true;
  }

  async function handleSubmit() {
    modalLoading = true;
    const payload = {
      nom: modalForm.nom,
      tel: modalForm.tel,
      email: modalForm.email || null,
      categorie_principale: modalForm.categorie,
      zone: modalForm.zone || null,
      groupe: modalForm.groupe
    };

    let error;
    if (isEditMode) {
      const res = await supabase.from('contacts_repertoire').update(payload).eq('id', modalForm.id);
      error = res.error;
    } else {
      const res = await supabase.from('contacts_repertoire').insert([payload]);
      error = res.error;
    }

    modalLoading = false;
    if (error) alert("Erreur: " + error.message);
    else {
      showModal = false;
      loadContacts();
    }
  }

  async function deleteContact(id) {
    if(!confirm("Supprimer ce contact ?")) return;
    await supabase.from('contacts_repertoire').delete().eq('id', id);
    loadContacts();
  }

  // --- EXPORT ---
  function exportData(type) {
    // Aplatir les données affichées
    const flatData = Object.values(displayedContacts).flat().map(c => ({
        "Nom": c.nom,
        "Groupe": c.groupe,
        "Téléphone": formatPhone(c.tel),
        "Email": c.email || '',
        "Catégorie": c.categorie_principale,
        "Zone": c.zone || ''
    }));

    if (flatData.length === 0) return alert("Rien à exporter.");

    if (type === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(flatData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Repertoire");
        XLSX.writeFile(wb, "repertoire.xlsx");
    } else {
        const doc = new jsPDF();
        doc.text("Répertoire Téléphonique", 14, 15);
        autoTable(doc, {
            startY: 25,
            head: [['Nom', 'Groupe', 'Tel', 'Email', 'Cat', 'Zone']],
            body: flatData.map(Object.values),
            styles: { fontSize: 8 }
        });
        doc.save("repertoire.pdf");
    }
  }
</script>

<svelte:head>
  <title>Répertoire | BACO</title>
</svelte:head>

<div class="space-y-6">

  <div class="flex flex-col md:flex-row justify-between items-center gap-4">
    <h1 class="text-3xl font-bold text-gray-800 dark:text-white">Répertoire</h1>
    
    <div class="flex items-center gap-4">
      <div class="hidden md:flex bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button on:click={() => switchView('grid')} class="p-2 {viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}">
            <LayoutGrid class="w-5 h-5" />
        </button>
        <button on:click={() => switchView('list')} class="p-2 {viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}">
            <List class="w-5 h-5" />
        </button>
      </div>

      <div class="flex gap-2">
        {#if Object.keys(displayedContacts).length > 0}
            <button on:click={() => exportData('pdf')} class="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow"><FileText class="w-5 h-5"/></button>
        {/if}
        {#if isAdmin}
            <button on:click={() => openModal()} class="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">
                <Plus class="w-5 h-5" /> <span class="hidden sm:inline">Ajouter</span>
            </button>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex flex-col md:flex-row gap-4">
    <div class="relative flex-grow">
        <Search class="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        <input 
            type="search" 
            bind:value={searchTerm} 
            placeholder="Rechercher (Nom, Tel, Groupe...)" 
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500"
        >
    </div>
    
    <div class="flex rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button on:click={() => sortOrder = 'az'} class="px-3 py-2 flex items-center gap-2 {sortOrder === 'az' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-600 dark:text-gray-300'} border-r dark:border-gray-700 rounded-l-lg">
            <ArrowDownAZ class="w-4 h-4"/> A-Z
        </button>
        <button on:click={() => sortOrder = 'za'} class="px-3 py-2 flex items-center gap-2 {sortOrder === 'za' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-600 dark:text-gray-300'} rounded-r-lg">
            <ArrowDownZA class="w-4 h-4"/> Z-A
        </button>
    </div>
  </div>

  <div class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
    
    <div>
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">1. Catégories</h3>
        {#if loadingCategories}
            <div class="text-sm text-gray-500">Chargement...</div>
        {:else}
            <div class="flex flex-wrap gap-2">
                {#each categories as cat}
                    <button 
                        on:click={() => toggleCategory(cat)}
                        class="flex items-center space-x-2 px-3 py-1.5 border rounded-full text-sm transition-all shadow-sm 
                        {selectedCategories.includes(cat) 
                            ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900 dark:border-blue-400 dark:text-blue-100' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'}"
                    >
                        {#if selectedCategories.includes(cat)}<CheckSquare class="w-3.5 h-3.5" />{:else}<Square class="w-3.5 h-3.5" />{/if}
                        <span>{cat}</span>
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    {#if showZoneFilters}
        <div class="pt-4 border-t border-gray-100 dark:border-gray-700 animate-fade-in">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">2. Zones</h3>
            <div class="flex flex-wrap gap-2">
                {#each zones as zone}
                    <button 
                        on:click={() => toggleZone(zone)}
                        class="flex items-center space-x-2 px-3 py-1.5 border rounded-full text-sm transition-all shadow-sm 
                        {selectedZones.includes(zone) 
                            ? 'bg-purple-100 border-purple-500 text-purple-800 dark:bg-purple-900 dark:border-purple-400 dark:text-purple-100' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'}"
                    >
                        {#if selectedZones.includes(zone)}<CheckSquare class="w-3.5 h-3.5" />{:else}<Square class="w-3.5 h-3.5" />{/if}
                        <span>{zone}</span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}
  </div>

  <div class="mt-8">
    {#if loading}
        <div class="flex justify-center py-12"><Loader2 class="w-10 h-10 animate-spin text-blue-500"/></div>
    
    {:else if Object.keys(displayedContacts).length === 0}
        <div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
            <UserX class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p class="text-gray-500 dark:text-gray-400">
                {selectedCategories.length === 0 && !searchTerm ? 'Sélectionnez une catégorie pour commencer.' : 'Aucun contact trouvé.'}
            </p>
        </div>

    {:else}
        <div class="{viewMode === 'list' ? 'space-y-6' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start'}">
            {#each Object.keys(displayedContacts).sort() as group}
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    
                    <button 
                        on:click={() => viewMode === 'grid' && toggleGroupAccordion(group)}
                        class="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-left {viewMode === 'list' ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'}"
                    >
                        <h3 class="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <FolderOpen class="w-4 h-4 text-blue-500" /> {group} 
                            <span class="text-xs font-normal text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{displayedContacts[group].length}</span>
                        </h3>
                        {#if viewMode === 'grid'}
                            <ChevronDown class="w-5 h-5 text-gray-400 transition-transform {openGroups[group] ? 'rotate-180' : ''}" />
                        {/if}
                    </button>

                    {#if viewMode === 'list' || openGroups[group]}
                        <div class="divide-y divide-gray-100 dark:divide-gray-700">
                            {#each displayedContacts[group] as contact}
                                <div class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 flex items-center justify-between group/item">
                                    
                                    <div class="min-w-0">
                                        <div class="font-medium text-gray-900 dark:text-gray-100 truncate" title={contact.nom}>
                                            {contact.nom}
                                        </div>
                                        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                                            {#if contact.tel}
                                                <a href="etrali:{cleanPhone(contact.tel)}" class="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-mono">
                                                    <Phone class="w-3 h-3" /> {formatPhone(contact.tel)}
                                                </a>
                                            {/if}
                                            {#if contact.email}
                                                <a href="mailto:{contact.email}" class="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 truncate">
                                                    <Mail class="w-3 h-3" /> {contact.email}
                                                </a>
                                            {/if}
                                        </div>
                                    </div>

                                    {#if isAdmin}
                                        <div class="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                            <button on:click={() => openModal(contact)} class="p-1.5 text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded"><Pencil class="w-3.5 h-3.5" /></button>
                                            <button on:click={() => deleteContact(contact.id)} class="p-1.5 text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded"><Trash2 class="w-3.5 h-3.5" /></button>
                                        </div>
                                    {/if}

                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
  </div>

</div>

{#if showModal}
  <div class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h3 class="text-xl font-bold mb-4 dark:text-white">{isEditMode ? 'Modifier' : 'Ajouter'}</h3>
        
        <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
                <label class="block text-sm mb-1 dark:text-gray-300">Nom</label>
                <input bind:value={modalForm.nom} class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            </div>
            <div>
                <label class="block text-sm mb-1 dark:text-gray-300">Téléphone</label>
                <input bind:value={modalForm.tel} class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            </div>
            <div>
                <label class="block text-sm mb-1 dark:text-gray-300">Email</label>
                <input bind:value={modalForm.email} type="email" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            </div>
            <div>
                <label class="block text-sm mb-1 dark:text-gray-300">Catégorie</label>
                <input bind:value={modalForm.categorie} placeholder="MIA, DSE..." class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            </div>
            <div>
                <label class="block text-sm mb-1 dark:text-gray-300">Zone</label>
                <input bind:value={modalForm.zone} placeholder="FMS, FTY..." class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            </div>
            <div class="col-span-2">
                <label class="block text-sm mb-1 dark:text-gray-300">Groupe</label>
                <input bind:value={modalForm.groupe} placeholder="SPI, PACO..." class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
            <button on:click={() => showModal = false} class="px-4 py-2 border rounded dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Annuler</button>
            <button on:click={handleSubmit} disabled={modalLoading} class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                {modalLoading ? '...' : 'Enregistrer'}
            </button>
        </div>
    </div>
  </div>
{/if}