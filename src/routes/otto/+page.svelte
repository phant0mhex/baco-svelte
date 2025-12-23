<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { fly, fade, slide } from 'svelte/transition';
  import jsPDF from 'jspdf'; // Correction casse pour build Vercel
  import autoTable from 'jspdf-autotable';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import * as XLSX from 'xlsx';
  import { 
    Bus, Calendar, Clock, MapPin, CheckSquare, Square, 
    FileText, Save, Trash2, Plus, Loader2, ArrowLeft,
    Printer, Download, Building2, Hash, Users, ArrowRightLeft, MinusCircle,
    Search, Filter, X, CheckCircle, User, UserCheck, ChevronDown, Mail, ClipboardCopy, Check
  } from 'lucide-svelte';
  import { toast } from '$lib/stores/toast.js';

  // --- ÉTATS ---
  let view = 'list';
  let isLoading = true;
  let isSaving = false;
  let commandes = [];
  let showEmailExport = false;
  let hasCopied = false;

  let currentUserProfile = null;
  let showCompanyDropdown = false;
  let searchTerm = "";
  let statusFilter = "all";
  let dateFilter = "";

  let availableLines = [];
  let availableStops = [];
  let uniqueStationNames = [];
  let availableSocietes = [];

  // --- FORMULAIRE ---
  const initialForm = {
    id: null,
    status: 'brouillon',
    relation: 'TC_',
    motif: '',
    date_commande: new Date().toISOString().split('T')[0],
    heure_appel: '',
    societe_id: null,
    lignes: [],
    arrets: [],
    origine: '',
    destination: '',
    is_direct: true, 
    is_mail_sent: false,
    is_aller_retour: false,
    nombre_voyageurs: null,
    nombre_pmr: null,
    capacite_bus: 50,
    bus_data: [
        { plaque: '', heure_prevue: '', heure_confirmee: '', heure_demob: '' }
    ]
  };
  
  let form = JSON.parse(JSON.stringify(initialForm));

  onMount(async () => {
    await Promise.all([loadCommandes(), loadLinesRef(), loadSocietes(), loadAllStops(), loadCurrentUser()]);
    isLoading = false;
  });

  $: if (form.relation && !form.relation.startsWith('TC_')) {
      form.relation = 'TC_';
  }

  // --- FILTRES ---
  $: filteredCommandes = commandes.filter(cmd => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (
          (cmd.relation || '').toLowerCase().includes(term) ||
          (cmd.motif || '').toLowerCase().includes(term) ||
          (cmd.societes_bus?.nom || '').toLowerCase().includes(term) ||
          (cmd.origine || '').toLowerCase().includes(term) ||
          (cmd.destination || '').toLowerCase().includes(term)
      );
      const matchesStatus = statusFilter === 'all' || cmd.status === statusFilter;
      const matchesDate = !dateFilter || cmd.date_commande === dateFilter;
      return matchesSearch && matchesStatus && matchesDate;
  });

  // --- CHARGEMENT ---
  async function loadCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
          currentUserProfile = data;
      }
  }

  // --- EXPORTS EXCEL / PDF LISTE ---
  function exportToExcel() {
    const dataToExport = filteredCommandes.map(cmd => ({
        Relation: cmd.relation,
        Type: cmd.is_direct ? 'Direct' : 'Omnibus',
        Société: cmd.societes_bus?.nom || 'Inconnue',
        Statut: cmd.status === 'envoye' ? 'Clôturé' : 'Brouillon',
        Date: new Date(cmd.date_commande).toLocaleDateString('fr-BE'),
        Origine: cmd.origine || '',
        Destination: cmd.destination || '',
        Mail: cmd.is_mail_sent ? 'Envoyé' : 'Non'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Commandes Otto");
    XLSX.writeFile(workbook, `Export_Otto_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel généré !");
  }

  function exportListPDF() {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text("Liste des Commandes Bus (Otto)", 15, 15);
    const rows = filteredCommandes.map(cmd => [
        cmd.relation, cmd.is_direct ? 'Direct' : 'Omnibus', cmd.societes_bus?.nom || '-',
        cmd.status === 'envoye' ? 'Clôturé' : 'Brouillon', new Date(cmd.date_commande).toLocaleDateString('fr-BE'),
        cmd.origine + " -> " + cmd.destination
    ]);
    autoTable(doc, {
        startY: 25,
        head: [['Relation', 'Type', 'Société', 'Statut', 'Date', 'Parcours']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 }
    });
    doc.save(`Liste_Otto_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  // --- FONCTIONS EMAIL ---
  $: emailBody = `Bonjour, voici le réquisitoire pour le trajet de ce ${new Date(form.date_commande).toLocaleDateString('fr-BE')} entre ${form.origine || '?'} et ${form.destination || '?'} - ${form.relation} (${form.is_direct ? 'Direct' : 'Omnibus'})

Merci pour vos services,

Cordialement,

${form.validator?.full_name || currentUserProfile?.full_name || 'Équipe PACO'}`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(emailBody);
      hasCopied = true;
      toast.success("Message copié !");
      setTimeout(() => hasCopied = false, 2000);
    } catch (err) { toast.error("Erreur copie"); }
  }

  function sendEmail() {
    const society = availableSocietes.find(s => s.id === form.societe_id);
    const emailTo = society?.email || "";
    const subject = encodeURIComponent(`Réquisitoire Bus - ${form.relation} - ${new Date(form.date_commande).toLocaleDateString('fr-BE')}`);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${encodeURIComponent(emailBody)}`;
    toast.info("Joignez le PDF dans Outlook !");
  }

  // --- LOGIQUE METIER ---
  async function loadCommandes() {
    const { data, error } = await supabase.from('otto_commandes').select(`*, creator:user_id(full_name), validator:validated_by(full_name), societes_bus(nom, adresse, telephone, email)`).order('created_at', { ascending: false });
    if (!error) {
        commandes = data;
        const urlId = $page.url.searchParams.get('id');
        if (urlId && view === 'list') {
            const cmdToOpen = data.find(c => c.id == urlId);
            if (cmdToOpen) openEdit(cmdToOpen, false);
        }
    }
  }

  async function loadLinesRef() {
    const { data } = await supabase.from('ligne_data').select('ligne_nom').order('ligne_nom');
    if (data) availableLines = [...new Set(data.map(l => l.ligne_nom))];
  }

  async function loadAllStops() {
    const { data } = await supabase.from('ligne_data').select('gare').not('gare', 'is', null).order('gare');
    if (data) uniqueStationNames = [...new Set(data.map(d => d.gare))].sort();
  }

  async function loadSocietes() {
    const { data } = await supabase.from('societes_bus').select('*').order('nom');
    if (data) availableSocietes = data;
  }

  $: if (form.lignes.length > 0) loadStopsForLines(form.lignes);
  else availableStops = [];

  let stopsMetadata = []; 
  async function loadStopsForLines(lines) {
      const { data } = await supabase.from('ligne_data').select('gare, ligne_nom, ordre').in('ligne_nom', lines);
      if (data) {
          stopsMetadata = data;
          availableStops = [...new Set(data.map(d => `${d.gare} (${d.ligne_nom})`))];
      }
  }

  function getSortedArrets(arretsSelectionnes, lignesSelectionnees) {
      if (arretsSelectionnes.length <= 1) return arretsSelectionnes;
      const mapped = arretsSelectionnes.map(stopFull => {
          const [gare, rest] = stopFull.split(' (');
          const ligneNom = rest.replace(')', '');
          return stopsMetadata.find(m => m.gare === gare && m.ligne_nom === ligneNom);
      }).filter(Boolean);
      let finalSorted = [];
      lignesSelectionnees.forEach(nomLigne => {
          let arretsDeCetteLigne = mapped.filter(m => m.ligne_nom === nomLigne);
          if (arretsDeCetteLigne.length === 0) return;
          const estDecroissant = (nomLigne === 'L.90C');
          arretsDeCetteLigne.sort((a, b) => estDecroissant ? b.ordre - a.ordre : a.ordre - b.ordre);
          finalSorted.push(...arretsDeCetteLigne);
      });
      return finalSorted.map(m => `${m.gare} (${m.ligne_nom})`);
  }

  function toggleLine(line) {
      if (form.lignes.includes(line)) form.lignes = form.lignes.filter(l => l !== line);
      else form.lignes = [...form.lignes, line];
  }

  function toggleStop(stop) {
      if (form.arrets.includes(stop)) form.arrets = form.arrets.filter(s => s !== stop);
      else form.arrets = [...form.arrets, stop];
  }

  function addBus() {
      const lastBus = form.bus_data.length > 0 ? form.bus_data[form.bus_data.length - 1] : {};
      form.bus_data = [...form.bus_data, { plaque: '', heure_prevue: lastBus.heure_prevue || '', heure_confirmee: '', heure_demob: lastBus.heure_demob || '' }];
  }

  function removeBus(index) {
      if (form.bus_data.length > 1) form.bus_data = form.bus_data.filter((_, i) => i !== index);
  }

  function selectSociete(id) {
      form.societe_id = id;
      showCompanyDropdown = false;
  }

  function goBackToList() {
      view = 'list';
      goto('/otto', { replaceState: true, noScroll: true });
  }

  function openNew() {
      form = JSON.parse(JSON.stringify(initialForm));
      view = 'form';
      goto('/otto', { replaceState: true, noScroll: true });
  }

  function openEdit(cmd, updateUrl = true) {
      form = { ...cmd, bus_data: (cmd.bus_data?.length > 0) ? cmd.bus_data : [{ plaque: '', heure_prevue: '', heure_confirmee: '', heure_demob: '' }] };
      view = 'form';
      if (updateUrl) goto(`?id=${cmd.id}`, { replaceState: false, noScroll: true });
  }

  async function saveCommande(targetStatus = 'brouillon') {
      if (!form.motif || !form.societe_id) return toast.error("Champs requis manquants");
      isSaving = true;
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
          ...form,
          arrets: form.is_direct ? [] : form.arrets, // Vide si direct
          status: targetStatus,
          validated_by: targetStatus === 'envoye' ? user.id : form.validated_by
      };
      if (!form.id) payload.user_id = user.id;
      delete payload.creator; delete payload.validator; delete payload.societes_bus;

      const { error } = form.id ? await supabase.from('otto_commandes').update(payload).eq('id', form.id) : await supabase.from('otto_commandes').insert([payload]);
      isSaving = false;
      if (!error) {
          toast.success("Enregistré");
          await loadCommandes();
          goBackToList();
      }
  }

  async function deleteCommande(id) {
      if (confirm("Supprimer ?")) {
          await supabase.from('otto_commandes').delete().eq('id', id);
          loadCommandes();
      }
  }

  const getBase64ImageFromURL = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = url;
    });
  };

  async function generatePDF() {
    const doc = new jsPDF();
    const society = availableSocietes.find(s => s.id === form.societe_id);
    try { const logo = await getBase64ImageFromURL('/SNCB_logo.png'); doc.addImage(logo, 'PNG', 15, 10, 25, 16); } catch(e){}
    doc.setFontSize(9); doc.text(form.creator?.full_name || currentUserProfile?.full_name || "", 15, 40);
    doc.text(["SNCB", "Passenger BPT2", "Mons"], 15, 45);
    
    doc.setFontSize(11); doc.text(society?.nom || "", 195, 20, { align: 'right' });
    
    let y = 75; doc.rect(15, y, 180, 20);
    doc.setFont("helvetica", "bold"); doc.text("Demande service bus", 105, y+10, {align:'center'});

    y += 30; doc.rect(15, y-5, 180, 100);
    doc.text(`Date: ${new Date(form.date_commande).toLocaleDateString()}`, 20, y);
    doc.text(`Type: ${form.is_direct ? 'DIRECT' : 'OMNIBUS'}`, 110, y);
    y+=10; doc.text(`Origine: ${form.origine}`, 20, y);
    y+=10; doc.text(`Destination: ${form.destination}`, 20, y);
    
    if (!form.is_direct && form.arrets.length > 0) {
        y+=10; doc.text("Arrêts: " + form.arrets.join(', '), 20, y, {maxWidth: 170});
    }

    autoTable(doc, {
        startY: y + 20,
        head: [['Véhicule', 'Plaque', 'H. Prévue']],
        body: form.bus_data.map(b => [ 'Bus', b.plaque, b.heure_prevue ])
    });
    doc.save(`Ordre_Bus_${form.relation}.pdf`);
  }

  const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-orange-500/50";
  const labelClass = "block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1";
</script>

<div class="container mx-auto p-4 md:p-8 space-y-6 min-h-screen">
  <header class="flex justify-between items-end border-b border-white/5 pb-6">
    <div class="flex items-center gap-3">
      <div class="p-3 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20"><Bus size={32} /></div>
      <div><h1 class="text-3xl font-bold text-white">C3</h1><p class="text-gray-500 text-xs">Commandes Bus</p></div>
    </div>
    {#if view === 'list'}<button on:click={openNew} class="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2"><Plus size={18}/> Nouveau</button>
    {:else}<button on:click={goBackToList} class="text-gray-400 hover:text-white flex items-center gap-2"><ArrowLeft size={18}/> Retour</button>{/if}
  </header>

  {#if isLoading} <div class="flex justify-center py-20"><Loader2 class="animate-spin text-orange-500" /></div>
  {:else}
    {#if view === 'list'}
      <div class="flex flex-wrap gap-4 items-center bg-black/20 p-4 rounded-2xl border border-white/5">
        <input type="text" bind:value={searchTerm} placeholder="Rechercher..." class="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white">
        <button on:click={exportToExcel} class="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl border border-emerald-500/20 flex items-center gap-2"><Download size={16}/> Excel</button>
        <button on:click={exportListPDF} class="bg-red-500/10 text-red-400 px-4 py-2 rounded-xl border border-red-500/20 flex items-center gap-2"><Printer size={16}/> PDF</button>
      </div>

      <div class="grid gap-4">
        {#each filteredCommandes as cmd}
          <div class="bg-black/20 border border-white/5 p-6 rounded-2xl flex justify-between group hover:border-orange-500/30 transition-all">
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <span class="text-xl font-bold text-white">{cmd.relation}</span>
                <span class="text-[10px] px-2 py-0.5 rounded border font-bold {cmd.is_direct ? 'border-orange-500/40 text-orange-400' : 'border-yellow-500/40 text-yellow-400'}">{cmd.is_direct ? 'DIRECT' : 'OMNIBUS'}</span>
                <span class="text-xs text-blue-400">{cmd.societes_bus?.nom}</span>
                {#if cmd.is_mail_sent}<CheckCircle size={14} class="text-emerald-500" />{/if}
              </div>
              <p class="text-sm text-gray-400">{cmd.origine} <ArrowRightLeft size={12} class="inline mx-1"/> {cmd.destination}</p>
            </div>
            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button on:click={() => openEdit(cmd)} class="p-2 text-blue-400 hover:bg-white/5 rounded-lg"><FileText size={20}/></button>
              <button on:click={() => deleteCommande(cmd.id)} class="p-2 text-red-400 hover:bg-white/5 rounded-lg"><Trash2 size={20}/></button>
            </div>
          </div>
        {/each}
      </div>

    {:else}
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-32">
        <div class="xl:col-span-2 space-y-6">
            <div class="bg-black/20 border border-white/5 p-6 rounded-2xl grid md:grid-cols-2 gap-4">
                <div class="md:col-span-2"><label class={labelClass}>Motif</label><input bind:value={form.motif} class={inputClass}></div>
                <div><label class={labelClass}>Date</label><input type="date" bind:value={form.date_commande} class="{inputClass} dark:[color-scheme:dark]"></div>
                <div><label class={labelClass}>Relation</label><input bind:value={form.relation} class={inputClass}></div>
                <div class="md:col-span-2">
                    <label class={labelClass}>Société</label>
                    <button on:click={() => showCompanyDropdown = !showCompanyDropdown} class="{inputClass} flex justify-between items-center">
                        {availableSocietes.find(s => s.id === form.societe_id)?.nom || 'Sélectionner...'} <ChevronDown size={16}/>
                    </button>
                    {#if showCompanyDropdown}
                        <div class="absolute z-50 mt-2 bg-gray-900 border border-white/10 rounded-xl w-64 max-h-48 overflow-y-auto">
                            {#each availableSocietes as soc}
                                <button on:click={() => selectSociete(soc.id)} class="w-full text-left p-3 hover:bg-white/5 text-sm text-gray-300 border-b border-white/5 last:border-0">{soc.nom}</button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="bg-black/20 border border-white/5 p-6 rounded-2xl space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="text-sm font-bold text-blue-400 uppercase">Parcours</h3>
                    <div class="flex gap-3">
                        <label class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer">
                            <input type="checkbox" bind:checked={form.is_direct} class="hidden">
                            <span class="text-[10px] font-bold {form.is_direct ? 'text-orange-400' : 'text-gray-500'}">DIRECT</span>
                            <div class="w-8 h-4 bg-gray-700 rounded-full relative">
                                <div class="absolute top-1 left-1 w-2 h-2 bg-white rounded-full transition-transform {form.is_direct ? '' : 'translate-x-4'}"></div>
                            </div>
                            <span class="text-[10px] font-bold {!form.is_direct ? 'text-yellow-400' : 'text-gray-500'}">OMNIBUS</span>
                        </label>
                    </div>
                </div>
                <div class="grid md:grid-cols-2 gap-4">
                    <input bind:value={form.origine} placeholder="Origine" list="stations" class={inputClass}>
                    <input bind:value={form.destination} placeholder="Destination" list="stations" class={inputClass}>
                    <datalist id="stations">{#each uniqueStationNames as s}<option value={s}/>{/each}</datalist>
                </div>
            </div>

            <div class="bg-black/20 border border-white/5 p-6 rounded-2xl space-y-4">
                <div class="flex justify-between items-center"><h3 class="text-sm font-bold text-green-400">Bus</h3><button on:click={addBus} class="text-xs font-bold text-green-400">+ Ajouter</button></div>
                {#each form.bus_data as bus, i}
                    <div class="bg-white/5 border border-white/10 p-3 rounded-xl flex gap-3">
                        <input bind:value={bus.plaque} placeholder="Plaque" class="bg-transparent border-b border-white/10 text-xs w-24">
                        <input type="time" bind:value={bus.heure_prevue} class="bg-transparent text-xs text-white">
                        <button on:click={() => removeBus(i)} class="text-gray-500 ml-auto"><MinusCircle size={16}/></button>
                    </div>
                {/each}
            </div>
        </div>

        <div class="space-y-6">
            <div class="bg-black/20 border border-white/5 p-6 rounded-2xl max-h-80 overflow-y-auto">
                <h3 class="text-sm font-bold text-purple-400 mb-4 uppercase">Lignes</h3>
                <div class="flex flex-wrap gap-2">
                    {#each availableLines as line}
                        <button on:click={() => toggleLine(line)} class="px-3 py-1.5 rounded-lg text-xs font-bold border {form.lignes.includes(line) ? 'bg-purple-600 border-purple-400 text-white' : 'bg-white/5 text-gray-500'}">{line}</button>
                    {/each}
                </div>
            </div>
            {#if !form.is_direct && form.lignes.length > 0}
                <div class="bg-black/20 border border-white/5 p-6 rounded-2xl max-h-80 overflow-y-auto" transition:slide>
                    <h3 class="text-sm font-bold text-yellow-400 mb-4 uppercase">Arrêts</h3>
                    <div class="grid gap-1">
                        {#each availableStops as stop}
                            <button on:click={() => toggleStop(stop)} class="text-left text-xs p-2 rounded hover:bg-white/5 {form.arrets.includes(stop) ? 'text-yellow-400' : 'text-gray-500'}">
                                {form.arrets.includes(stop) ? '●' : '○'} {stop}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <div class="fixed bottom-4 left-4 right-4 z-50 bg-[#0f1115]/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex flex-wrap items-center justify-end gap-4 shadow-2xl">
            <label class="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer mr-auto group">
                <div class="relative w-10 h-5 bg-gray-700 rounded-full transition-colors peer-checked:bg-emerald-500">
                    <input type="checkbox" bind:checked={form.is_mail_sent} class="sr-only peer">
                    <div class="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider {form.is_mail_sent ? 'text-emerald-400' : 'text-gray-500'}">
                    {form.is_mail_sent ? 'Mail envoyé' : 'Mail non envoyé'}
                </span>
            </label>

            <button on:click={() => showEmailExport = true} class="px-5 py-2 rounded-full text-blue-400 bg-blue-500/5 border border-blue-500/10 flex items-center gap-2 text-sm font-bold"><Mail size={16}/> E-mail</button>
            <button on:click={generatePDF} class="px-5 py-2 rounded-full text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-2 text-sm font-bold"><Printer size={16}/> PDF</button>
            <button on:click={() => saveCommande('brouillon')} class="px-5 py-2 rounded-full text-gray-400 bg-white/5 text-sm font-bold">Brouillon</button>
            <button on:click={() => saveCommande('envoye')} class="px-6 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold shadow-lg shadow-red-900/20 flex items-center gap-2">
                {#if isSaving}<Loader2 class="animate-spin" size={16}/>{:else}<CheckCircle size={16}/>{/if} Clôturer
            </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if showEmailExport}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
    <div class="bg-gray-900 border border-white/10 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl">
      <div class="flex justify-between items-center"><h3 class="text-white font-bold flex items-center gap-2"><Mail size={20}/> Export Email</h3><button on:click={() => showEmailExport = false} class="text-gray-500 hover:text-white"><X size={20}/></button></div>
      <div class="relative">
        <textarea readonly class="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-gray-400 font-mono" bind:value={emailBody}></textarea>
        <button on:click={copyToClipboard} class="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2">
            {#if hasCopied}<Check size={12}/> Copié{:else}<ClipboardCopy size={12}/> Copier{/if}
        </button>
      </div>
      <div class="flex gap-3">
        <button on:click={() => showEmailExport = false} class="flex-1 bg-white/5 text-gray-400 py-2 rounded-xl font-bold">Fermer</button>
        <button on:click={sendEmail} class="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"><Mail size={16}/> Outlook</button>
      </div>
    </div>
  </div>
{/if}