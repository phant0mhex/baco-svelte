<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { fly, fade, slide } from 'svelte/transition';
  import jsPDF from 'jspdf'; // Correction de la casse pour le build Vercel
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

  // --- EXPORTS ---
  function exportToExcel() {
    const dataToExport = filteredCommandes.map(cmd => ({
        Relation: cmd.relation,
        Type: cmd.is_direct ? 'Direct' : 'Omnibus',
        Société: cmd.societes_bus?.nom || 'Inconnue',
        Statut: cmd.status === 'envoye' ? 'Clôturé' : 'Brouillon',
        Date: new Date(cmd.date_commande).toLocaleDateString('fr-BE'),
        Origine: cmd.origine || '',
        Destination: cmd.destination || '',
        Motif: cmd.motif || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Commandes Otto");
    XLSX.writeFile(workbook, `Export_Otto_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Fichier Excel généré !");
  }

  function exportListPDF() {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text("Liste des Commandes Bus (Otto)", 15, 15);
    
    const rows = filteredCommandes.map(cmd => [
        cmd.relation,
        cmd.is_direct ? 'Direct' : 'Omnibus',
        cmd.societes_bus?.nom || '-',
        cmd.status === 'envoye' ? 'Clôturé' : 'Brouillon',
        new Date(cmd.date_commande).toLocaleDateString('fr-BE'),
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
    toast.success("Liste PDF générée !");
  }

  async function loadCommandes() {
    const { data, error } = await supabase
      .from('otto_commandes')
      .select(`*, creator:user_id(full_name), validator:validated_by(full_name), societes_bus(nom, adresse, telephone, email)`)
      .order('created_at', { ascending: false });
    
    if (error) {
        toast.error("Erreur chargement");
    } else {
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
    const { data } = await supabase.from('societes_bus').select('id, nom, adresse, telephone, email').order('nom');
    if (data) availableSocietes = data;
  }

  $: emailBody = `Bonjour, voici le réquisitoire pour le trajet de ce ${new Date(form.date_commande).toLocaleDateString('fr-BE')} entre ${form.origine || '?'} et ${form.destination || '?'} - ${form.relation} (${form.is_direct ? 'Direct' : 'Omnibus'})

Merci pour vos services,

Cordialement,

${form.validator?.full_name || currentUserProfile?.full_name || 'Équipe PACO'}`;

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
      form.relation = 'TC_';
      view = 'form';
      goto('/otto', { replaceState: true, noScroll: true });
  }

  function openEdit(cmd, updateUrl = true) {
      form = { 
          ...cmd,
          bus_data: (cmd.bus_data && cmd.bus_data.length > 0) ? cmd.bus_data : [{ plaque: cmd.plaque || '', heure_prevue: cmd.heure_prevue || '', heure_confirmee: cmd.heure_confirmee || '', heure_demob: cmd.heure_demob || '' }]
      };
      view = 'form';
      if (updateUrl) goto(`?id=${cmd.id}`, { replaceState: false, noScroll: true, keepFocus: true });
  }

  async function saveCommande(targetStatus = 'brouillon') {
      if (!form.motif) return toast.error("Le motif est requis");
      if (!form.societe_id) return toast.error("Veuillez sélectionner une société");
      if (!form.relation || form.relation.trim() === 'TC_' || form.relation.length < 4) {
          return toast.error("Le numéro de relation doit être complété (ex: TC_123)");
      }

      isSaving = true;
      const user = await supabase.auth.getUser();
      const currentUserId = user.data.user?.id;
      
      const payload = {
          motif: form.motif,
          relation: form.relation,
          date_commande: form.date_commande,
          heure_appel: form.heure_appel,
          societe_id: form.societe_id,
          lignes: form.lignes,
          // MODIFICATION : On force le tableau vide si is_direct est vrai
          arrets: form.is_direct ? [] : form.arrets, 
          is_direct: form.is_direct,
          origine: form.origine,
          destination: form.destination,
          is_aller_retour: form.is_aller_retour,
          nombre_voyageurs: form.nombre_voyageurs,
          nombre_pmr: form.nombre_pmr,
          is_mail_sent: form.is_mail_sent,
          capacite_bus: form.capacite_bus,
          bus_data: form.bus_data,
          status: targetStatus
      };

      if (!form.id) payload.user_id = currentUserId;
      if (targetStatus === 'envoye') payload.validated_by = currentUserId;

      let error;
      if (form.id) {
          const res = await supabase.from('otto_commandes').update(payload).eq('id', form.id);
          error = res.error;
      } else {
          const res = await supabase.from('otto_commandes').insert([payload]).select();
          error = res.error;
      }

      isSaving = false;
      if (error) {
          toast.error("Erreur: " + error.message);
      } else {
          toast.success(targetStatus === 'envoye' ? "Commande clôturée !" : "Brouillon sauvegardé");
          await loadCommandes();
          goBackToList();
      }
  }

  async function deleteCommande(id) {
      if (!confirm("Supprimer cette commande ?")) return;
      await supabase.from('otto_commandes').delete().eq('id', id);
      loadCommandes();
      toast.success("Supprimé");
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
      img.onerror = error => reject(error);
      img.src = url;
    });
  };

  async function generatePDF() {
    const doc = new jsPDF();
    const society = availableSocietes.find(s => s.id === form.societe_id);
    let creatorName = form.creator?.full_name || currentUserProfile?.full_name || "Inconnu";

    try {
        const logoData = await getBase64ImageFromURL('/SNCB_logo.png');
        doc.addImage(logoData, 'PNG', 15, 10, 25, 16.33);
    } catch (e) {}

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(creatorName, 15, 40);
    doc.setFont("helvetica", "normal");
    doc.text(["SNCB", "Coordinateur Passenger BPT2", "Rue du Musée François Duesberg 1", "7000 Mons", "TEL: +32(0)2 436 0460", "paco.mons@belgiantrain.be"], 15, 45);

    const rightX = 195;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(society?.nom || "Société Inconnue", rightX, 20, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let yr = 25;
    if(society?.adresse) {
        const splitAdd = doc.splitTextToSize(society.adresse, 60);
        doc.text(splitAdd, rightX, yr, { align: 'right' });
        yr += (splitAdd.length * 4);
    }
    doc.text(`Tel: ${society?.telephone || '-'}`, rightX, yr, { align: 'right' });
    doc.text(society?.email || '-', rightX, yr + 4, { align: 'right' });

    let y = 75;
    doc.rect(15, y, 180, 20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Demande service bus de remplacement", 105, y + 7, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(200, 0, 0);
    doc.text("NON planifié / Real Time", 105, y + 12, { align: 'center' });
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text("Partie A – Service opérationnels SNCB", 105, y + 17, { align: 'center' });

    y += 25;
    doc.rect(15, y, 180, 130);
    y += 8;
    const labelX = 20; const valueX = 70;

    doc.setFont("helvetica", "bold"); doc.text("Date de circulation :", labelX, y);
    doc.setFont("helvetica", "normal"); doc.text(new Date(form.date_commande).toLocaleDateString('fr-BE'), valueX, y);
    doc.setFont("helvetica", "bold"); doc.text("Type :", 110, y);
    doc.setFont("helvetica", "normal"); doc.text(form.is_direct ? "DIRECT (Sans arrêt)" : "OMNIBUS (Avec arrêts)", 130, y);

    y += 10;
    doc.setDrawColor(200); doc.line(20, y-4, 190, y-4); doc.setDrawColor(0);

    doc.setFont("helvetica", "bold"); doc.text("Lieu Origine :", labelX, y);
    doc.setFont("helvetica", "normal"); doc.text(form.origine || '?', valueX, y);
    y += 6;

    if (!form.is_direct && form.arrets?.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Arrêts intermédiaires :", labelX, y);
        doc.setFont("helvetica", "normal"); 
        const sorted = getSortedArrets(form.arrets, form.lignes);
        const arretsSplit = doc.splitTextToSize(sorted.join(', '), 120);
        doc.text(arretsSplit, valueX, y);
        y += (arretsSplit.length * 5) + 2;
    }

    doc.setFont("helvetica", "bold"); doc.text("Lieu Destination :", labelX, y);
    doc.setFont("helvetica", "normal"); doc.text(form.destination || '?', valueX, y);
    y += 8;

    doc.setFont("helvetica", "bold"); doc.text("Deux sens :", labelX, y);
    doc.setFont("helvetica", "normal"); doc.text(form.is_aller_retour ? "OUI" : "NON", valueX, y);
    y += 8;

    doc.setFont("helvetica", "bold"); doc.text("Lignes concernées :", labelX, y);
    doc.setFont("helvetica", "normal"); doc.text(form.lignes.join(', ') || '-', valueX, y);
    doc.setFont("helvetica", "bold"); doc.text("Heure d'appel :", 110, y);
    doc.setFont("helvetica", "normal"); doc.text(form.heure_appel || '--:--', 140, y);
    y += 10;

    const busRows = form.bus_data.map((b, i) => [`Bus ${i+1}`, b.plaque || '?', b.heure_prevue || '-', b.heure_confirmee || '-', b.heure_demob || '-']);
    autoTable(doc, {
        startY: y,
        head: [['Véhicule', 'Plaque', 'H. Prévue', 'H. Confirmée', 'Démob.']],
        body: busRows,
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 20 },
        tableWidth: 170
    });

    y = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold"); doc.text("Nombre de voyageurs :", labelX, y);
    doc.setFont("helvetica", "normal"); doc.text(String(form.nombre_voyageurs || 'Non communiqué'), valueX + 10, y);
    doc.setFont("helvetica", "bold"); doc.text("Dont PMR :", 130, y);
    doc.setFont("helvetica", "normal"); doc.text(String(form.nombre_pmr || '0'), 155, y);

    const footerY = 230;
    doc.rect(15, footerY, 180, 45);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold"); doc.text("Adresse de facturation :", 20, footerY + 6);
    doc.setFont("helvetica", "normal"); doc.text(["SNCB", "Purchase Accounting B-F.224", "Rue de France 56", "1060 BRUXELLES"], 20, footerY + 12);
    const legX = 100;
    doc.setFont("helvetica", "bold"); doc.text("Mentions obligatoires sur la facture :", legX, footerY + 6);
    doc.setFont("helvetica", "normal"); doc.text(`Numéro de TVA : BE 0203 430 576`, legX, footerY + 12);
    doc.text(`N° SAP de la commande : 4522 944 778`, legX, footerY + 17);
    doc.setFont("helvetica", "bold"); doc.text(`Numéro de relation TC : ${form.relation}`, legX, footerY + 25);

    doc.save(`Ordre_Bus_${form.relation}.pdf`);
  }

  const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all placeholder-gray-600";
  const labelClass = "block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 flex items-center gap-1";
</script>

<svelte:head>
  <title>C3 | Commande Bus</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8 space-y-8 min-h-screen">

  <header class="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6" in:fly={{ y: -20 }}>
    <div class="flex items-center gap-3">
        <div class="p-3 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-sm">
          <Bus class="w-8 h-8" />
        </div>
        <div>
          <h1 class="text-3xl font-bold text-gray-200 tracking-tight">C3</h1>
          <p class="text-gray-500 text-sm mt-1">Commandes de Bus & Substitution.</p>
        </div>
    </div>
    
    {#if view === 'list'}
        <button on:click={openNew} class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all">
            <Plus class="w-5 h-5" /> Nouvelle Commande
        </button>
    {:else}
        <button on:click={goBackToList} class="bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all">
            <ArrowLeft class="w-5 h-5" /> Retour liste
        </button>
    {/if}
  </header>

  {#if isLoading}
    <div class="flex justify-center py-20"><Loader2 class="w-10 h-10 animate-spin text-orange-500/50" /></div>
  {:else}

    {#if view === 'list'}
        <div class="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col xl:flex-row gap-4 justify-between items-center" in:fly={{ y: 10 }}>
            <div class="relative w-full xl:w-96 group">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    <Search class="w-5 h-5" />
                </div>
                <input type="text" bind:value={searchTerm} placeholder="Rechercher..." class="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"/>
            </div>

            <div class="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-center">
                <div class="relative group w-full sm:w-auto">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                        <Calendar class="w-4 h-4" />
                    </div>
                    <input type="date" bind:value={dateFilter} class="w-full sm:w-40 bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white text-sm dark:[color-scheme:dark]"/>
                    {#if dateFilter}<button on:click={() => dateFilter = ""} class="absolute right-2 top-2.5 text-gray-500 hover:text-white"><X size={14}/></button>{/if}
                </div>

                <div class="flex gap-2">
                    <button on:click={exportToExcel} class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 flex items-center gap-2"><Download size={14} /> Excel</button>
                    <button on:click={exportListPDF} class="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-2"><Printer size={14} /> PDF</button>
                </div>

                <div class="flex gap-2 w-full sm:w-auto">
                    <button on:click={() => statusFilter = 'all'} class="flex-1 px-4 py-2 rounded-xl text-sm font-bold border transition-all {statusFilter === 'all' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}">Tous</button>
                    <button on:click={() => statusFilter = 'brouillon'} class="flex-1 px-4 py-2 rounded-xl text-sm font-bold border transition-all {statusFilter === 'brouillon' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}">Brouillons</button>
                    <button on:click={() => statusFilter = 'envoye'} class="flex-1 px-4 py-2 rounded-xl text-sm font-bold border transition-all {statusFilter === 'envoye' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}">Clôturés</button>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4" in:fly={{ y: 20 }}>
            {#if filteredCommandes.length === 0}
                <div class="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-black/20">
                    <p class="text-gray-500">Aucune commande trouvée.</p>
                </div>
            {:else}
                {#each filteredCommandes as cmd}
                    <div class="bg-black/20 border border-white/5 hover:border-orange-500/30 rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-4 transition-all group">
                        <div class="flex-grow min-w-0 w-full">
                            <div class="flex items-center gap-3 mb-3 flex-wrap">
                                <span class="text-xl font-extrabold text-white tracking-tight">{cmd.relation}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border {cmd.is_direct ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}">
                                    {cmd.is_direct ? 'Direct' : 'Omnibus'}
                                </span>
                                <span class="flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-bold uppercase">
                                    <Building2 size={12} /> {cmd.societes_bus?.nom || 'Inconnu'}
                                </span>
                                <span class="text-xs px-2 py-0.5 rounded border font-bold {cmd.status === 'envoye' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}">
                                    {cmd.status === 'envoye' ? 'Clôturé' : 'Brouillon'}
                                </span>
                            </div>
                            <div class="flex items-center gap-2 text-sm text-gray-400 mb-3">
                                <span class="text-gray-300">{cmd.origine || '?'}</span>
                                <ArrowRightLeft size={12} class="text-orange-500/50" />
                                <span class="text-gray-300">{cmd.destination || '?'}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button on:click={() => openEdit(cmd)} class="p-2 hover:bg-white/10 rounded-lg text-blue-400"><FileText class="w-5 h-5" /></button>
                            <button on:click={() => deleteCommande(cmd.id)} class="p-2 hover:bg-red-500/10 rounded-lg text-red-400"><Trash2 class="w-5 h-5" /></button>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>

    {:else}
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-8" in:fade>
            <div class="xl:col-span-2 space-y-6">
                <div class="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4">
                    <h3 class="text-sm font-bold text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2"><FileText size={16}/> Mission</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2"><label class={labelClass}>Motif</label><input type="text" bind:value={form.motif} class={inputClass} placeholder="Dérangement..."></div>
                        <div><label class={labelClass}>Date</label><input type="date" bind:value={form.date_commande} class="{inputClass} dark:[color-scheme:dark]"></div>
                        <div><label class={labelClass}>Relation</label><input type="text" bind:value={form.relation} class={inputClass} placeholder="TC_123"></div>
                        <div>
                            <label class={labelClass}>Société</label>
                            <div class="relative">
                                <button type="button" on:click={() => showCompanyDropdown = !showCompanyDropdown} class="{inputClass} flex items-center justify-between text-left">
                                    <span class="{form.societe_id ? 'text-white' : 'text-gray-500'} truncate">{availableSocietes.find(s => s.id === form.societe_id)?.nom || '-- Sélectionner --'}</span>
                                    <ChevronDown size={16} class="text-gray-500 {showCompanyDropdown ? 'rotate-180' : ''} transition-transform"/>
                                </button>
                                {#if showCompanyDropdown}
                                    <div class="fixed inset-0 z-40" on:click={() => showCompanyDropdown = false}></div>
                                    <div class="absolute top-full left-0 w-full mt-2 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto" transition:slide>
                                        {#each availableSocietes as soc}
                                            <button type="button" on:click={() => selectSociete(soc.id)} class="w-full text-left px-4 py-3 hover:bg-white/10 text-gray-300 flex justify-between items-center">
                                                {soc.nom}
                                                {#if form.societe_id === soc.id}<CheckCircle size={14} class="text-orange-400"/>{/if}
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div class="flex flex-wrap justify-between items-center gap-4 mb-4">
                        <h3 class="text-sm font-bold text-blue-400 uppercase tracking-wide flex items-center gap-2"><MapPin size={16}/> Parcours</h3>
                        <div class="flex items-center gap-4">
                            <label class="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 border border-white/10">
                                <input type="checkbox" bind:checked={form.is_direct} class="hidden">
                                <span class="text-[10px] font-bold {form.is_direct ? 'text-orange-400' : 'text-gray-500'} uppercase">Direct</span>
                                <div class="relative w-8 h-4 bg-gray-700 rounded-full">
                                    <div class="absolute top-1 left-1 w-2 h-2 bg-white rounded-full transition-transform {form.is_direct ? '' : 'translate-x-4'}"></div>
                                </div>
                                <span class="text-[10px] font-bold {!form.is_direct ? 'text-yellow-400' : 'text-gray-500'} uppercase">Omnibus</span>
                            </label>

                            <label class="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                                <input type="checkbox" bind:checked={form.is_aller_retour} class="hidden">
                                <span class="text-xs font-bold {form.is_aller_retour ? 'text-blue-400' : 'text-gray-500'}">A/R</span>
                                {#if form.is_aller_retour}<ArrowRightLeft size={14} class="text-blue-400"/>{:else}<span>→</span>{/if}
                            </label>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" list="stations" bind:value={form.origine} class={inputClass} placeholder="Origine">
                        <input type="text" list="stations" bind:value={form.destination} class={inputClass} placeholder="Destination">
                    </div>
                </div>

                <div class="bg-black/20 border border-white/5 rounded-2xl p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-sm font-bold text-green-400 uppercase tracking-wide flex items-center gap-2"><Bus size={16}/> Véhicules</h3>
                        <button on:click={addBus} class="text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/30">+ Bus</button>
                    </div>
                    <div class="space-y-4">
                        {#each form.bus_data as bus, i}
                            <div class="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                <div class="flex justify-between items-center px-4 py-1 bg-black/20">
                                    <span class="text-[10px] font-bold text-orange-400 uppercase">Bus #{i+1}</span>
                                    <button on:click={() => removeBus(i)} class="text-gray-500 hover:text-red-400"><MinusCircle size={14}/></button>
                                </div>
                                <div class="p-3 grid grid-cols-4 gap-2">
                                    <input type="text" bind:value={bus.plaque} class="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white uppercase" placeholder="Plaque">
                                    <input type="time" bind:value={bus.heure_prevue} class="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white">
                                    <input type="time" bind:value={bus.heure_confirmee} class="bg-black/30 border border-green-900/30 rounded px-2 py-1.5 text-xs text-green-300">
                                    <input type="time" bind:value={bus.heure_demob} class="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white">
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                <div class="bg-black/20 border border-white/5 rounded-2xl p-6 max-h-[400px] overflow-y-auto">
                    <h3 class="text-sm font-bold text-purple-400 uppercase mb-4 sticky top-0 bg-[#16181d] py-1 flex items-center gap-2"><Hash size={16}/> Lignes</h3>
                    <div class="flex flex-wrap gap-2">
                        {#each availableLines as line}
                            <button on:click={() => toggleLine(line)} class="px-3 py-1.5 rounded-lg text-xs font-bold border {form.lignes.includes(line) ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400'}">{line}</button>
                        {/each}
                    </div>
                </div>

                {#if !form.is_direct && form.lignes.length > 0}
                    <div class="bg-black/20 border border-white/5 rounded-2xl p-6 max-h-[400px] overflow-y-auto" transition:slide>
                        <h3 class="text-sm font-bold text-yellow-400 uppercase mb-4 sticky top-0 bg-[#16181d] py-1 flex items-center gap-2"><MapPin size={16}/> Arrêts</h3>
                        <div class="space-y-1">
                            {#each availableStops as stop}
                                <button on:click={() => toggleStop(stop)} class="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-3 {form.arrets.includes(stop) ? 'bg-yellow-500/10 text-yellow-300' : 'text-gray-400'}">
                                    {#if form.arrets.includes(stop)}<CheckSquare class="w-4 h-4"/>{:else}<Square class="w-4 h-4"/>{/if}
                                    {stop}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <div class="fixed bottom-4 left-4 right-4 z-50 flex flex-wrap justify-end items-center gap-4 p-4 border border-white/10 bg-[#0f1115]/80 backdrop-blur-2xl rounded-2xl shadow-2xl">
            <button on:click={() => generatePDF()} class="px-5 py-2.5 rounded-full text-sm font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-2"><Printer class="w-4 h-4" /> PDF</button>
            <button on:click={() => saveCommande('brouillon')} disabled={isSaving} class="px-6 py-2.5 rounded-full text-sm text-gray-400 bg-white/5 flex items-center gap-2"><Save class="w-4 h-4" /> Brouillon</button>
            <button on:click={() => saveCommande('envoye')} disabled={isSaving} class="px-6 py-2.5 rounded-full text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 flex items-center gap-2 shadow-lg shadow-red-900/30">
                {#if isSaving}<Loader2 class="w-4 h-4 animate-spin"/>{:else}<CheckCircle class="w-4 h-4" />{/if} Clôturer
            </button>
        </div>
        <div class="h-24"></div>
    {/if}
  {/if}
</div>