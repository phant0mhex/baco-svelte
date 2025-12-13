<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Plus, Search, Filter, MapPin, 
    AlertTriangle, X, Save, Trash2, Pencil, PenTool
  } from 'lucide-svelte';

  let pmrs = [];
  let isLoading = true;
  let isSaving = false;
  let isModalOpen = false;
  let filters = { search: "", zone: "all", etat: "all", type: "all" };
  let editingPmr = { id: null, gare: "", quai: "", zone: "", type_assistance: "N/A", type_rampe: "", rampe_id: "", etat_rampe: "OK", validite: "", cadenas: "", reparation_demandee: false, remarque_rampe: "", restrictions_gare: "", remarque_gare: "" };

  onMount(() => { loadPmrData(); });

  async function loadPmrData() {
    isLoading = true;
    let query = supabase.from('pmr_data').select('*').order('gare', { ascending: true });
    if (filters.zone !== 'all') query = query.eq('zone', filters.zone);
    if (filters.etat !== 'all') query = query.eq('etat_rampe', filters.etat);
    if (filters.type !== 'all') query = query.eq('type_assistance', filters.type);
    if (filters.search.trim()) query = query.or(`gare.ilike.%${filters.search.trim()}%,quai.ilike.%${filters.search.trim()}%,rampe_id.ilike.%${filters.search.trim()}%`);
    const { data } = await query;
    pmrs = data || [];
    isLoading = false;
  }

  async function handleSave() {
    isSaving = true;
    const payload = { ...editingPmr };
    Object.keys(payload).forEach(k => { if (payload[k] === '' || payload[k] === 'N/A') payload[k] = null; });
    delete payload.id;
    const query = editingPmr.id ? supabase.from('pmr_data').update(payload).eq('id', editingPmr.id) : supabase.from('pmr_data').insert([payload]);
    await query;
    isSaving = false;
    closeModal();
    loadPmrData();
  }

  async function deleteEntry(id) {
    if (confirm("Supprimer cette entrée ?")) {
      await supabase.from('pmr_data').delete().eq('id', id);
      loadPmrData();
    }
  }

  function openModal(entry = null) {
    editingPmr = entry ? { ...entry, type_assistance: entry.type_assistance || 'N/A', etat_rampe: entry.etat_rampe || 'OK' } : { id: null, gare: "", quai: "", zone: "", type_assistance: "N/A", type_rampe: "", rampe_id: "", etat_rampe: "OK", validite: "", cadenas: "", reparation_demandee: false, remarque_rampe: "", restrictions_gare: "", remarque_gare: "" };
    isModalOpen = true;
  }
  function closeModal() { isModalOpen = false; }

  const statusColors = {
    'OK': 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    'HS': 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
    'En attente': 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  };
  function getBadgeClass(status) { return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'; }
  
  // Styles communs définis en JS pour éviter la répétition sans @apply
  const labelClass = "block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase";
  const inputClass = "block w-full rounded-xl border-gray-200 bg-white p-3 text-sm font-medium focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 transition-shadow shadow-sm";
</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-10">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
          <MapPin size={24} />
        </div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Gestion PMR & Rampes</h1>
      </div>
      <button on:click={() => openModal()} class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow active:scale-95">
        <Plus size={20} /> <span class="hidden sm:inline">Nouvelle entrée</span>
      </button>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-8">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div class="md:col-span-5">
          <label class="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Recherche</label>
          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500"><Search size={18} /></div>
            <input type="text" bind:value={filters.search} on:input={loadPmrData} placeholder="Gare, quai, n° rampe..." class="block w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all" />
          </div>
        </div>
        {#each [{ label: 'Zone', val: 'zone', opts: ['FTY', 'FMS', 'FCR'] }, { label: 'État', val: 'etat', opts: ['OK', 'HS', 'En attente'] }, { label: 'Type', val: 'type', opts: ['Full', 'Light', 'Taxi'] }] as f}
          <div class="md:col-span-2">
            <label class="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5 ml-1">{f.label}</label>
            <div class="relative">
              <select bind:value={filters[f.val]} on:change={loadPmrData} class="block w-full pl-3 pr-8 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm appearance-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="all">Tous</option>
                {#each f.opts as opt}<option value={opt}>{opt}</option>{/each}
              </select>
              <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500"><Filter size={14} /></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    {#if isLoading}
      <div class="flex flex-col items-center justify-center py-20 text-gray-400"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div><p>Chargement...</p></div>
    {:else if pmrs.length === 0}
      <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
        <Search size={32} class="mx-auto text-gray-400 mb-4" /><h3 class="text-lg font-medium text-gray-900 dark:text-white">Aucun résultat</h3>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each pmrs as item}
          <div class="group bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden">
            <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {item.gare}
                  {#if item.zone}<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">{item.zone}</span>{/if}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Quai <strong class="text-gray-700 dark:text-gray-200">{item.quai || '?'}</strong></p>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-bold border {getBadgeClass(item.etat_rampe)}">{item.etat_rampe || 'N/A'}</span>
            </div>
            <div class="p-6 space-y-3 text-sm flex-grow">
              {#if item.rampe_id}<div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50"><span class="text-gray-500 dark:text-gray-400">ID Rampe</span><span class="font-mono font-medium">{item.rampe_id}</span></div>{/if}
              {#if item.type_assistance && item.type_assistance !== 'N/A'}<div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50"><span class="text-gray-500 dark:text-gray-400">Assistance</span><span class="font-medium text-blue-600 dark:text-blue-400">{item.type_assistance}</span></div>{/if}
              {#if item.reparation_demandee}<div class="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 mt-2"><AlertTriangle size={14} /> Réparation en cours</div>{/if}
              {#if item.restrictions_gare || item.remarque_rampe}<div class="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50 leading-relaxed">{item.restrictions_gare || item.remarque_rampe}</div>{/if}
            </div>
            <div class="p-4 bg-gray-50/50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button on:click={() => openModal(item)} class="p-2.5 text-blue-600 hover:bg-white dark:hover:bg-blue-900/30 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200"><Pencil size={18} /></button>
               <button on:click={() => deleteEntry(item.id)} class="p-2.5 text-red-600 hover:bg-white dark:hover:bg-red-900/30 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200"><Trash2 size={18} /></button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  {#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" on:click={closeModal}></div>
      <div class="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">{#if editingPmr.id} <PenTool size={20} class="text-blue-500"/> {/if} {editingPmr.id ? 'Modifier la fiche' : 'Nouvelle fiche PMR'}</h2>
          <button on:click={closeModal} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={24} /></button>
        </div>
        <div class="p-8 overflow-y-auto space-y-8 bg-gray-50/50 dark:bg-gray-900/50">
          <section>
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span> Localisation</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="col-span-1"><label class={labelClass}>Zone</label><input type="text" bind:value={editingPmr.zone} class={inputClass} placeholder="FTY..." /></div>
              <div class="col-span-1"><label class={labelClass}>Code Gare</label><input type="text" bind:value={editingPmr.gare} class={inputClass} placeholder="ABC" /></div>
              <div class="col-span-1"><label class={labelClass}>Quai</label><input type="text" bind:value={editingPmr.quai} class={inputClass} placeholder="1" /></div>
            </div>
          </section>
          <hr class="border-gray-100 dark:border-gray-700" />
          <section>
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-orange-500"></span> Matériel & État</h3>
            <div class="grid grid-cols-2 gap-4">
              <div><label class={labelClass}>Type Assistance</label><select bind:value={editingPmr.type_assistance} class={inputClass}><option value="N/A">Non défini</option><option value="3h">3h</option><option value="Full">Full</option><option value="Light">Light</option><option value="Taxi">Taxi</option></select></div>
              <div><label class={labelClass}>État Rampe</label><select bind:value={editingPmr.etat_rampe} class={inputClass}><option value="OK">Fonctionnelle (OK)</option><option value="HS">Hors Service (HS)</option><option value="En attente">En attente</option></select></div>
              <div><label class={labelClass}>ID Rampe</label><input type="text" bind:value={editingPmr.rampe_id} class={inputClass} placeholder="R-1234" /></div>
              <div><label class={labelClass}>Type Rampe</label><input type="text" bind:value={editingPmr.type_rampe} class={inputClass} placeholder="Mobile..." /></div>
              <div><label class={labelClass}>Cadenas</label><input type="text" bind:value={editingPmr.cadenas} class={inputClass} placeholder="Code..." /></div>
              <div><label class={labelClass}>Validité</label><input type="text" bind:value={editingPmr.validite} class={inputClass} placeholder="MM/YY" /></div>
            </div>
            <div class="mt-4"><label class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors bg-white dark:bg-gray-800"><input type="checkbox" bind:checked={editingPmr.reparation_demandee} class="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500" /><span class="text-sm font-bold text-gray-700 dark:text-gray-300">Une réparation est demandée</span></label></div>
          </section>
          <hr class="border-gray-100 dark:border-gray-700" />
          <section>
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-purple-500"></span> Notes</h3>
            <div class="space-y-4">
              <div><label class={labelClass}>Remarque sur la rampe</label><textarea rows="2" bind:value={editingPmr.remarque_rampe} class="{inputClass} resize-none"></textarea></div>
              <div class="grid grid-cols-2 gap-4">
                <div><label class="{labelClass} text-red-500">Restrictions Gare</label><textarea rows="2" bind:value={editingPmr.restrictions_gare} class="{inputClass} resize-none border-red-100 focus:border-red-500 focus:ring-red-500"></textarea></div>
                <div><label class="{labelClass} text-blue-500">Infos Gare</label><textarea rows="2" bind:value={editingPmr.remarque_gare} class="{inputClass} resize-none border-blue-100 focus:border-blue-500 focus:ring-blue-500"></textarea></div>
              </div>
            </div>
          </section>
        </div>
        <div class="px-8 py-5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 z-10">
          <button on:click={closeModal} class="px-6 py-3 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 transition-all">Annuler</button>
          <button on:click={handleSave} disabled={isSaving} class="px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center gap-2"><Save size={18} /> Enregistrer</button>
        </div>
      </div>
    </div>
  {/if}
</div>