<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { fly, fade } from 'svelte/transition';
  import { 
    Bus, FileText, Plus, X, Pencil, Trash2, 
    Phone, MapPin, CheckSquare, Square, Loader2, Check 
  } from 'lucide-svelte';
  
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';

  // --- ÉTATS (DATA) ---
  let user = null;
  let isAdmin = false;

  // Données de sélection
  const availableLines = ['L.75', 'L.75A', 'L.78', 'L.90', 'L.90C', 'L.94', 'L.96', 'L.97', 'L.108', 'L.112', 'L.116', 'L.117', 'L.118', 'L.124', 'L.130', 'L.130A', 'L.132', 'L.134', 'L.140'];
  let selectedLines = [];
  let selectedSocieteIds = [];

  // Résultats
  let societesAffichees = [];
  let contactsAffiches = [];
  let chauffeursAffiches = [];

  // Loaders
  let loadingSocietes = false;
  let loadingDetails = false;

  // Modale
  let showModal = false;
  let modalLoading = false;
  let isEditMode = false;
  let modalForm = {
    id: null,
    nom: '',
    lignes: '',
    contacts: '',
    chauffeurs: ''
  };

  // --- INITIALISATION ---
  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      isAdmin = data?.role === 'admin';
    }
  });

  // --- LOGIQUE RÉACTIVE ---
  $: if (selectedLines) loadSocietes();
  $: if (selectedSocieteIds) loadDetails();

  async function loadSocietes() {
    societesAffichees = [];
    selectedSocieteIds = [];
    contactsAffiches = [];
    chauffeursAffiches = [];
    
    if (selectedLines.length === 0) return;

    loadingSocietes = true;
    
    const { data: lignesData, error: lErr } = await supabase
      .from('lignes_bus')
      .select('societe_id')
      .in('ligne', selectedLines);

    if (lErr) { console.error(lErr); loadingSocietes = false; return; }

    const uniqueIds = [...new Set(lignesData.map(item => item.societe_id))];

    if (uniqueIds.length > 0) {
      const { data: societes, error: sErr } = await supabase
        .from('societes_bus')
        .select('id, nom')
        .in('id', uniqueIds)
        .order('nom');
        
      if (!sErr) societesAffichees = societes;
    }
    loadingSocietes = false;
  }

  async function loadDetails() {
    contactsAffiches = [];
    chauffeursAffiches = [];

    if (selectedSocieteIds.length === 0) return;

    loadingDetails = true;

    // Contacts
    const { data: contacts } = await supabase
      .from('contacts_bus')
      .select('id, nom, tel, societes_bus ( nom )')
      .in('societe_id', selectedSocieteIds);
    if (contacts) contactsAffiches = contacts;

    // Chauffeurs
    const { data: chauffeurs } = await supabase
      .from('chauffeurs_bus')
      .select('id, nom, tel, societes_bus ( nom )')
      .in('societe_id', selectedSocieteIds);
    if (chauffeurs) chauffeursAffiches = chauffeurs;

    loadingDetails = false;
  }

  // --- FONCTIONS UTILITAIRES ---
  function toggleLine(line) {
    if (selectedLines.includes(line)) {
      selectedLines = selectedLines.filter(l => l !== line);
    } else {
      selectedLines = [...selectedLines, line];
    }
  }

  function toggleSociete(id) {
    if (selectedSocieteIds.includes(id)) {
      selectedSocieteIds = selectedSocieteIds.filter(s => s !== id);
    } else {
      selectedSocieteIds = [...selectedSocieteIds, id];
    }
  }

  const cleanPhone = (tel) => tel ? tel.replace(/[^0-9]/g, '') : '';
  const formatPhone = (tel) => {
    const cleaned = cleanPhone(tel);
    return cleaned.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1/$2.$3.$4'); 
  };

  // --- GESTION MODALE ---
  async function openModal(societe = null) {
    isEditMode = !!societe;
    modalForm = { id: societe?.id || null, nom: societe?.nom || '', lignes: '', contacts: '', chauffeurs: '' };

    if (isEditMode) {
      const { data } = await supabase
        .from('societes_bus')
        .select(`lignes_bus (ligne), contacts_bus (nom, tel), chauffeurs_bus (nom, tel)`)
        .eq('id', societe.id)
        .single();
      
      if (data) {
        modalForm.lignes = data.lignes_bus.map(l => l.ligne).join(', ');
        modalForm.contacts = data.contacts_bus.map(c => `${c.nom}, ${c.tel}`).join('\n');
        modalForm.chauffeurs = data.chauffeurs_bus.map(c => `${c.nom}, ${c.tel}`).join('\n');
      }
    }
    showModal = true;
  }

  async function handleSubmit() {
    modalLoading = true;
    const parseList = (text) => text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
        const parts = line.split(',');
        return { nom: parts.shift()?.trim(), tel: parts.join(',').trim() };
    });

    const payload = {
      societe_id_to_update: modalForm.id,
      new_nom: modalForm.nom,
      new_lignes: modalForm.lignes.split(',').map(s => s.trim()).filter(Boolean),
      new_contacts: parseList(modalForm.contacts),
      new_chauffeurs: parseList(modalForm.chauffeurs)
    };

    const { error } = await supabase.rpc('upsert_societe_bus', payload);
    modalLoading = false;
    if (error) {
      alert("Erreur : " + error.message);
    } else {
      showModal = false;
      loadSocietes();
    }
  }

  async function deleteSociete(id, nom) {
    if (!confirm(`Supprimer ${nom} et tout son contenu ?`)) return;
    const { error } = await supabase.rpc('delete_societe_bus', { societe_id_to_delete: id });
    if (!error) loadSocietes();
  }

  async function exportPDF() {
    if (selectedLines.length === 0) return alert("Sélectionnez des lignes.");
    const doc = new jsPDF();
    doc.text(`Export Bus - Lignes : ${selectedLines.join(', ')}`, 14, 15);
    doc.save('bus-export.pdf');
  }

  // Styles communs Inputs
  const inputClass = "block w-full rounded-xl border-white/10 bg-black/40 p-3 text-sm font-medium text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-blue-500/50 transition-all outline-none";
  const labelClass = "block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide";
</script>

<svelte:head>
  <title>BACO - Section Bus</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8 space-y-8 min-h-screen">

  <header class="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-white/5 pb-6" in:fly={{ y: -20, duration: 600 }}>
    <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
          <Bus class="w-8 h-8" />
        </div>
        <div>
          <h1 class="text-3xl font-bold text-gray-200 tracking-tight">Répertoire Bus</h1>
          <p class="text-gray-500 text-sm mt-1">Gérer les lignes de substitution et contacts.</p>
        </div>
    </div>
    
    <div class="flex gap-3">
        {#if isAdmin}
            <button on:click={() => openModal()} class="bg-blue-600/20 hover:bg-blue-600/30 text-blue-100 border border-blue-500/30 px-5 py-3 rounded-xl flex items-center gap-2 transition-all hover:scale-105 group shadow-lg shadow-blue-900/10">
                <Plus class="w-5 h-5 group-hover:rotate-90 transition-transform" />
                <span class="font-semibold hidden sm:inline">Ajouter</span>
            </button>
        {/if}
    </div>
  </header>

  <div class="bg-black/20 border border-white/5 rounded-2xl p-6" in:fly={{ y: 20, duration: 600, delay: 100 }}>
    <h3 class="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2">
        <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
        Filtrer par ligne
    </h3>
    <div class="flex flex-wrap gap-3">
      {#each availableLines as line}
        <button 
          on:click={() => toggleLine(line)}
          class="flex items-center space-x-2 px-4 py-2 border rounded-full transition-all duration-300 text-sm font-medium shadow-sm hover:scale-105 active:scale-95
          {selectedLines.includes(line) 
            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20'}"
        >
          {#if selectedLines.includes(line)}
            <Check class="w-4 h-4 text-blue-400" />
          {:else}
            <div class="w-4 h-4 rounded-sm border-2 border-gray-600"></div>
          {/if}
          <span>{line}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="space-y-8 min-h-[400px]">
    
    {#if selectedLines.length === 0}
      <div class="flex flex-col items-center justify-center h-64 text-gray-500 bg-black/20 rounded-2xl border border-dashed border-white/10" in:fade>
        <Bus size={48} class="mb-4 opacity-50"/>
        <p>Veuillez sélectionner au moins une ligne ci-dessus.</p>
      </div>

    {:else if loadingSocietes}
      <div class="flex flex-col items-center justify-center h-64 text-gray-500">
        <Loader2 class="w-10 h-10 animate-spin text-blue-500/50 mb-3"/>
        <p>Recherche des sociétés...</p>
      </div>

    {:else if societesAffichees.length === 0}
      <div class="flex flex-col items-center justify-center h-64 text-gray-500 bg-black/20 rounded-2xl border border-dashed border-white/10">
        <p>Aucune société trouvée pour ces lignes.</p>
      </div>

    {:else}
      <div in:fly={{ y: 20, duration: 400 }}>
        <h3 class="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2">
            <div class="w-1 h-6 bg-blue-500 rounded-full"></div> Sociétés concernées
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each societesAffichees as societe}
            <div class="group flex items-center justify-between px-4 py-3 bg-black/20 border border-white/5 hover:border-blue-500/20 rounded-xl transition-all duration-200 cursor-pointer {selectedSocieteIds.includes(societe.id) ? 'bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20' : ''}">
              
              <label class="flex items-center space-x-3 cursor-pointer flex-grow mr-2 w-full h-full">
                <input 
                  type="checkbox" 
                  checked={selectedSocieteIds.includes(societe.id)}
                  on:change={() => toggleSociete(societe.id)}
                  class="rounded text-blue-600 focus:ring-blue-500 w-5 h-5 bg-black/40 border-gray-600 cursor-pointer"
                >
                <span class="font-bold text-gray-300 group-hover:text-white transition-colors">{societe.nom}</span>
              </label>

              {#if isAdmin}
                <div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button on:click={() => openModal(societe)} class="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors">
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button on:click={() => deleteSociete(societe.id, societe.nom)} class="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              {/if}

            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if selectedSocieteIds.length > 0}
      {#if loadingDetails}
        <div class="flex justify-center p-10"><Loader2 class="w-8 h-8 animate-spin text-blue-500/50"/></div>
      {:else}
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8" in:fly={{ y: 20, duration: 400 }}>
            {#if contactsAffiches.length > 0}
            <div class="bg-black/20 border border-white/5 rounded-2xl p-6 h-fit">
                <h3 class="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div> Contacts
                </h3>
                <ul class="space-y-3">
                {#each contactsAffiches as c}
                    <li class="bg-white/5 rounded-xl border border-white/5 p-3 flex justify-between items-center hover:bg-white/10 transition-colors group">
                    <div>
                        <span class="block font-bold text-gray-200">{c.nom}</span>
                        <span class="text-xs text-gray-500 uppercase tracking-wide">{c.societes_bus.nom}</span>
                    </div>
                    <a href="tel:{cleanPhone(c.tel)}" class="flex items-center gap-2 text-green-400 hover:text-green-300 font-mono bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 group-hover:bg-green-500/20 transition-all">
                        <Phone size={14} /> {formatPhone(c.tel)}
                    </a>
                    </li>
                {/each}
                </ul>
            </div>
            {/if}

            {#if chauffeursAffiches.length > 0}
            <div class="bg-black/20 border border-white/5 rounded-2xl p-6 h-fit">
                <h3 class="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> Chauffeurs
                </h3>
                <ul class="space-y-3">
                {#each chauffeursAffiches as c}
                    <li class="bg-white/5 rounded-xl border border-white/5 p-3 flex justify-between items-center hover:bg-white/10 transition-colors group">
                    <div>
                        <span class="block font-bold text-gray-200">{c.nom}</span>
                        <span class="text-xs text-gray-500 uppercase tracking-wide">{c.societes_bus.nom}</span>
                    </div>
                    <a href="tel:{cleanPhone(c.tel)}" class="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 font-mono bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20 group-hover:bg-yellow-500/20 transition-all">
                        <Phone size={14} /> {formatPhone(c.tel)}
                    </a>
                    </li>
                {/each}
                </ul>
            </div>
            {/if}
        </div>

      {/if}
    {/if}

  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" transition:fade>
    <div 
        class="bg-[#0f1115] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/10 ring-1 ring-white/5"
        transition:fly={{ y: 20, duration: 300 }}
    >
      
      <div class="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-white/[0.02]">
        <h3 class="text-xl font-bold text-gray-200">
          {isEditMode ? 'Modifier la société' : 'Nouvelle société'}
        </h3>
        <button on:click={() => showModal = false} class="text-gray-500 hover:text-gray-300 p-2 rounded-lg hover:bg-white/5 transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto custom-scrollbar">
        <div>
          <label class={labelClass}>Nom de la société</label>
          <input bind:value={modalForm.nom} type="text" class={inputClass}>
        </div>
        <div>
          <label class={labelClass}>Lignes (séparées par virgule)</label>
          <input bind:value={modalForm.lignes} type="text" placeholder="L.75, L.90..." class={inputClass}>
        </div>
        <div>
          <label class={labelClass}>Contacts (Nom, Tel - un par ligne)</label>
          <textarea bind:value={modalForm.contacts} rows="3" class="{inputClass} font-mono resize-none"></textarea>
        </div>
        <div>
          <label class={labelClass}>Chauffeurs (Nom, Tel - un par ligne)</label>
          <textarea bind:value={modalForm.chauffeurs} rows="5" class="{inputClass} font-mono resize-none"></textarea>
        </div>
      </div>

      <div class="flex justify-end items-center px-6 py-4 bg-white/[0.02] border-t border-white/10 gap-3 relative">
        <div class="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none"></div>

        <button on:click={() => showModal = false} class="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all">
          Annuler
        </button>
        <button on:click={handleSubmit} disabled={modalLoading} class="px-4 py-2 bg-blue-600/80 text-white rounded-xl hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center transition-all disabled:opacity-50">
          {#if modalLoading}<Loader2 class="w-4 h-4 animate-spin mr-2"/>{/if}
          Enregistrer
        </button>
      </div>
    </div>
  </div>
{/if}