<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { Bus, Clock, MapPin, Loader2, CheckCircle, AlertCircle } from 'lucide-svelte';
  import { fade } from 'svelte/transition';

  let commandes = [];
  let loading = true;

  onMount(async () => {
    // Récupération des 5 dernières commandes avec le nom de la société
    const { data, error } = await supabase
      .from('otto_commandes')
      .select('id, relation, motif, origine, destination, status, date_commande, is_mail_sent')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error) commandes = data;
    loading = false;
  });
</script>

<div class="bg-black/20 border border-white/5 rounded-2xl flex flex-col h-full overflow-hidden backdrop-blur-md">
  <div class="p-4 border-b border-white/5 flex items-center justify-between bg-orange-500/5">
    <div class="flex items-center gap-2">
      <Bus class="w-4 h-4 text-orange-400" />
      <h3 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Commandes C3</h3>
    </div>
    <a href="/otto" class="text-[10px] font-bold text-orange-400 hover:text-orange-300 transition-colors uppercase tracking-widest">Voir tout</a>
  </div>

  <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-2">
    {#if loading}
      <div class="flex justify-center py-8"><Loader2 class="w-6 h-6 animate-spin text-orange-500/20" /></div>
    {:else if commandes.length === 0}
      <p class="text-center py-8 text-xs text-gray-500 italic">Aucune commande récente</p>
    {:else}
      {#each commandes as cmd}
        <a href="/otto?id={cmd.id}" class="block p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-orange-500/20 transition-all group" in:fade>
          <div class="flex justify-between items-start mb-1">
            <span class="text-xs font-extrabold text-white tracking-tight">{cmd.relation}</span>
            <div class="flex gap-1">
               {#if cmd.is_mail_sent}
                <div class="p-0.5 bg-emerald-500/10 text-emerald-400 rounded" title="Mail envoyé">
                  <CheckCircle size={10} />
                </div>
              {/if}
              <span class="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold {cmd.status === 'envoye' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}">
                {cmd.status === 'envoye' ? 'Clôturé' : 'Brouillon'}
              </span>
            </div>
          </div>
          <p class="text-[11px] text-gray-400 truncate mb-2">{cmd.motif}</p>
          <div class="flex items-center justify-between text-[10px] text-gray-500">
            <div class="flex items-center gap-1 truncate max-w-[120px]">
              <MapPin size={10} /> {cmd.origine} → {cmd.destination}
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <Clock size={10} /> {new Date(cmd.date_commande).toLocaleDateString('fr-BE', {day:'2-digit', month:'2-digit'})}
            </div>
          </div>
        </a>
      {/each}
    {/if}
  </div>
</div>