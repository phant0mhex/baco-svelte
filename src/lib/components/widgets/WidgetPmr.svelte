<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { Activity, CheckCircle2, MapPin } from 'lucide-svelte';

    let pmrIssues = [];
    let loading = true;

    onMount(async () => {
        const { data } = await supabase.from('pmr_data').select('gare, quai, etat_rampe, rampe_id').in('etat_rampe', ['HS', 'En attente']).order('gare', { ascending: true });
        pmrIssues = data || [];
        loading = false;
    });
</script>

<div class="glass-panel p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md h-full flex flex-col">
    <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"><Activity class="w-6 h-6" /></div>
        <span class="text-xl font-bold text-white">Rampes PMR</span>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {#if loading}
            <div class="text-center text-gray-400 animate-pulse text-sm py-4">Chargement...</div>
        {:else if pmrIssues.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-green-500/50">
                <CheckCircle2 class="w-10 h-10 mb-2" />
                <span class="text-xs">Tout est opérationnel.</span>
            </div>
        {:else}
            {#each pmrIssues as issue}
                <a href="/pmr?search={issue.rampe_id || issue.gare}" class="block p-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-white text-sm">{issue.gare}</h4>
                        <span class="text-[10px] bg-red-500/20 px-2 rounded text-red-300">{issue.etat_rampe}</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin class="w-3 h-3" /> Quai {issue.quai || '?'}</div>
                </a>
            {/each}
        {/if}
    </div>
</div>