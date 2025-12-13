<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Car, MapPin, Phone, Search, Plus, FileText, 
    Pencil, Trash2, X, CheckSquare, Square, Loader2, RefreshCw, 
    Info, Home, Mail 
  } from 'lucide-svelte';
  
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';

  // --- ÉTATS ---
  let user = null;
  let isAdmin = false;

  // Filtres
  let lieuxDisponibles = []; 
  let loadingFilters = true;
  let selectedLieux = []; 

  let taxis = [];
  let loading = false;
  let searchTerm = "";

  // Modale
  let showModal = false;
  let modalLoading = false;
  let isEditMode = false;
  let modalForm = {
    id: null,
    societe: '',
    lieux: '', 
    contacts: '',
    mail: '',      // NOUVEAU
    adresse: '',   
    remarques: ''  
  };

  onMount(async () => {
    // 1. Auth
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      isAdmin = data?.role === 'admin';
    }

    // 2. Charger les filtres dynamiques
    await loadFilters();
  });

  // --- CHARGEMENT DES FILTRES ---
  async function loadFilters() {
    loadingFilters = true;
    try {
      const { data, error } = await supabase.from('taxis').select('lieux');
      if (error) throw error;

      const allLieux = (data || []).flatMap(row => row.lieux || []);
      const uniqueLieux = [...new Set(allLieux)]
        .filter(l => l && l !== 'nihil' && l.trim() !== '')
        .sort();

      lieuxDisponibles = uniqueLieux;
    } catch (err) {
      console.error("Erreur chargement filtres:", err);
    } finally {
      loadingFilters = false;
    }
  }

  // --- CHARGEMENT DES TAXIS ---
  
  $: if (selectedLieux) loadTaxis();

  async function loadTaxis() {
    if (selectedLieux.length === 0) {
      taxis = [];
      return;
    }

    loading = true;
    try {
      const { data, error } = await supabase
        .from('taxis')
        .select('*')
        .overlaps('lieux', selectedLieux)
        .order('nom');
      
      if (error) throw error;
      
      taxis = (data || []).map(t => ({
        ...t,
        societe: t.nom,
        // Sécurisation des tableaux pour l'affichage
        lieux: t.lieux || [],
        contacts: t.contacts || [],
        mail: t.mail || [], // NOUVEAU
        adresse: t.adresse || [],
        remarques: t.remarques || []
      }));

    } catch (err) {
      console.error("Erreur chargement taxis:", err);
    } finally {
      loading = false;
    }
  }

  // Filtrage local
  $: filteredTaxis = taxis.filter(t => 
    (t.societe || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.contacts.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  function toggleLieu(lieu) {
    if (selectedLieux.includes(lieu)) {
      selectedLieux = selectedLieux.filter(l => l !== lieu);
    } else {
      selectedLieux = [...selectedLieux, lieu];
    }
  }

  // --- UTILITAIRES ---
  const cleanPhone = (tel) => tel ? tel.replace(/[^0-9]/g, '') : '';
  const joinArray = (arr) => (Array.isArray(arr) && arr.length > 0 && arr[0] !== 'nihil') ? arr.join('\n') : '';
  const splitString = (str) => str.split('\n').map(s => s.trim()).filter(Boolean);

  // --- GESTION MODALE ---
  function openModal(taxi = null) {
    isEditMode = !!taxi;
    if (isEditMode) {
      modalForm = {
        id: taxi.id,
        societe: taxi.societe,
        lieux: joinArray(taxi.lieux).replace(/\n/g, ', '), 
        contacts: joinArray(taxi.contacts),
        mail: joinArray(taxi.mail),           // NOUVEAU
        adresse: joinArray(taxi.adresse),     
        remarques: joinArray(taxi.remarques)  
      };
    } else {
      modalForm = {
        id: null,
        societe: '',
        lieux: '',
        contacts: '',
        mail: '',
        adresse: '',
        remarques: ''
      };
    }
    showModal = true;
  }

  async function handleSubmit() {
    if (!modalForm.societe) return alert("Le nom est requis.");
    modalLoading = true;

    // Conversion String -> Tableau pour la DB
    const lieuxArray = modalForm.lieux.split(',').map(l => l.trim()).filter(Boolean);
    
    if (lieuxArray.length === 0) {
        alert("Veuillez entrer au moins un lieu.");
        modalLoading = false;
        return;
    }

    const payload = {
      nom: modalForm.societe,
      lieux: lieuxArray,
      contacts: splitString(modalForm.contacts),
      mail: splitString(modalForm.mail),           // NOUVEAU
      adresse: splitString(modalForm.adresse),     
      remarques: splitString(modalForm.remarques)  
    };

    let error;
    if (isEditMode) {
      const res = await supabase.from('taxis').update(payload).eq('id', modalForm.id);
      error = res.error;
    } else {
      const res = await supabase.from('taxis').insert([payload]);
      error = res.error;
    }

    modalLoading = false;
    if (error) alert("Erreur: " + error.message);
    else {
      showModal = false;
      await loadFilters();
      loadTaxis();
    }
  }

  async function deleteTaxi(id, nom) {
    if (!confirm(`Supprimer le taxi "${nom}" ?`)) return;
    const { error } = await supabase.from('taxis').delete().eq('id', id);
    if (!error) {
        await loadFilters(); 
        loadTaxis();
    }
  }

  // --- EXPORT PDF ---
  function exportPDF() {
    if (filteredTaxis.length === 0) return alert("Aucune donnée.");
    const doc = new jsPDF();
    doc.text(`Taxis - Lieux : ${selectedLieux.join(', ')}`, 14, 15);
    
    const rows = filteredTaxis.map(t => [
      t.societe,
      t.lieux.join(', '),
      t.contacts.join('\n'),
      t.mail.join('\n'), // NOUVEAU
      t.adresse.join('\n'),
      t.remarques.join('\n')
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Société', 'Lieux', 'Contacts', 'Emails', 'Adresse', 'Remarques']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 }
    });
    doc.save('taxis.pdf');
  }
</script>

<svelte:head>
  <title>Taxis | BACO</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div>
      <h1 class="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
        <Car class="w-8 h-8 text-yellow-500" /> Section Taxis
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Filtrer par lieu d'intervention.</p>
    </div>
    
    <div class="flex gap-2">
      {#if filteredTaxis.length > 0}
        <button on:click={exportPDF} class="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-colors">
          <FileText class="w-4 h-4" /> <span class="hidden sm:inline">PDF</span>
        </button>
      {/if}
      {#if isAdmin}
        <button on:click={() => openModal()} class="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">
          <Plus class="w-4 h-4" /> <span class="hidden sm:inline">Ajouter</span>
        </button>
      {/if}
    </div>
  </div>

  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="flex justify-between mb-4">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-medium text-gray-700 dark:text-gray-200">Secteurs disponibles :</h3>
        <button on:click={loadFilters} title="Rafraîchir les filtres" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <RefreshCw class="w-4 h-4 text-gray-400 {loadingFilters ? 'animate-spin' : ''}" />
        </button>
      </div>

      <div class="relative w-full md:w-64">
        <Search class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input type="text" bind:value={searchTerm} placeholder="Rechercher..." class="w-full pl-9 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-yellow-500">
      </div>
    </div>

    {#if loadingFilters && lieuxDisponibles.length === 0}
        <div class="text-sm text-gray-500">Chargement des secteurs...</div>
    {:else}
        <div class="flex flex-wrap gap-3">
        {#each lieuxDisponibles as lieu}
            <button 
            on:click={() => toggleLieu(lieu)}
            class="flex items-center space-x-2 px-4 py-2 border rounded-full transition-all shadow-sm 
            {selectedLieux.includes(lieu) 
                ? 'bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-400 dark:text-yellow-100' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'}"
            >
            {#if selectedLieux.includes(lieu)}<CheckSquare class="w-4 h-4" />{:else}<Square class="w-4 h-4" />{/if}
            <span>{lieu}</span>
            </button>
        {/each}
        </div>
    {/if}
  </div>

  <div>
    {#if selectedLieux.length === 0}
      <div class="text-center p-12 text-gray-500 dark:text-gray-400">
        <MapPin class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p>Sélectionnez un lieu pour voir les taxis.</p>
      </div>
    {:else if loading}
      <div class="flex justify-center p-12"><Loader2 class="w-10 h-10 animate-spin text-yellow-500" /></div>
    {:else if filteredTaxis.length === 0}
      <div class="text-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
        <p class="text-gray-500">Aucun taxi trouvé.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredTaxis as taxi}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all relative group flex flex-col">
            
            <div class="flex justify-between items-start mb-3">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white">{taxi.societe}</h3>
              <div class="flex flex-wrap gap-1 justify-end max-w-[50%]">
                 {#each taxi.lieux as l}
                    <span class="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs font-bold px-2 py-1 rounded {selectedLieux.includes(l) ? 'border border-yellow-400' : ''}">
                        {l}
                    </span>
                 {/each}
              </div>
            </div>

            <div class="space-y-2 mt-2 pt-3 border-t border-gray-100 dark:border-gray-700 flex-grow">
              {#each taxi.contacts as contactLine}
                 <div class="flex justify-between text-sm">
                   <span class="text-gray-600 dark:text-gray-400">{contactLine}</span>
                   <a href="tel:{cleanPhone(contactLine)}" class="text-blue-600 dark:text-blue-400 hover:underline"><Phone class="w-4 h-4 inline"/></a>
                 </div>
              {/each}
            </div>

            {#if taxi.mail && taxi.mail.length > 0 && taxi.mail[0] !== 'nihil'}
              <div class="mt-3 space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                {#each taxi.mail as email}
                  <a href="mailto:{email}" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <Mail class="w-4 h-4 flex-shrink-0" />
                    <span class="truncate">{email}</span>
                  </a>
                {/each}
              </div>
            {/if}

            {#if taxi.adresse && taxi.adresse.length > 0 && taxi.adresse[0] !== 'nihil'}
              <div class="mt-3 space-y-1">
                {#each taxi.adresse as addr}
                  <div class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                    <Home class="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                    <span>{addr}</span>
                  </div>
                {/each}
              </div>
            {/if}

            {#if taxi.remarques && taxi.remarques.length > 0 && taxi.remarques[0] !== 'nihil'}
              <div class="mt-3 space-y-1">
                {#each taxi.remarques as rem}
                  <div class="flex items-start gap-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-yellow-800 dark:text-yellow-200 border border-yellow-100 dark:border-yellow-900/30">
                    <Info class="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{rem}</span>
                  </div>
                {/each}
              </div>
            {/if}
            
            {#if isAdmin}
              <div class="absolute top-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button on:click={() => openModal(taxi)} class="p-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"><Pencil class="w-4 h-4" /></button>
                <button on:click={() => deleteTaxi(taxi.id, taxi.societe)} class="p-1 text-red-600 bg-red-50 hover:bg-red-100 rounded"><Trash2 class="w-4 h-4" /></button>
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
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div class="p-6 border-b dark:border-gray-700">
            <h3 class="text-xl font-bold dark:text-white">{isEditMode ? 'Modifier' : 'Ajouter'}</h3>
        </div>
        
        <div class="p-6 overflow-y-auto space-y-4 flex-grow">
            <div>
                <label class="block text-sm mb-1 dark:text-gray-300 font-medium">Nom société</label>
                <input bind:value={modalForm.societe} placeholder="Nom société" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-yellow-500">
            </div>
            
            <div>
                <label class="block text-sm mb-1 dark:text-gray-300 font-medium">Lieux couverts (séparés par virgules)</label>
                <input 
                    bind:value={modalForm.lieux} 
                    placeholder="Mons, La Louvière..." 
                    class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-yellow-500"
                >
            </div>
            
            <div>
                <label class="block text-sm mb-1 dark:text-gray-300 font-medium">Contacts (Un par ligne)</label>
                <textarea bind:value={modalForm.contacts} placeholder="Dispatche, 0477/..." rows="2" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-yellow-500"></textarea>
            </div>

            <div>
                <label class="block text-sm mb-1 dark:text-gray-300 font-medium">E-mails (Un par ligne)</label>
                <textarea bind:value={modalForm.mail} placeholder="contact@taxi.be" rows="2" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-yellow-500"></textarea>
            </div>

            <div>
                <label class="block text-sm mb-1 dark:text-gray-300 font-medium">Adresses (Une par ligne)</label>
                <textarea bind:value={modalForm.adresse} placeholder="Rue de la Gare 1, 7000 Mons" rows="2" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-yellow-500"></textarea>
            </div>

            <div>
                <label class="block text-sm mb-1 dark:text-gray-300 font-medium">Remarques (Une par ligne)</label>
                <textarea bind:value={modalForm.remarques} placeholder="Accepte les chèques..." rows="2" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-yellow-500"></textarea>
            </div>
        </div>
        
        <div class="p-6 border-t dark:border-gray-700 flex justify-end gap-2 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <button on:click={() => showModal = false} class="px-4 py-2 border rounded dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Annuler</button>
            <button on:click={handleSubmit} disabled={modalLoading} class="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center">
                {#if modalLoading}<Loader2 class="w-4 h-4 animate-spin mr-2"/>{/if}
                Enregistrer
            </button>
        </div>
    </div>
  </div>
{/if}