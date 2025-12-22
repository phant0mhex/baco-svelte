<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { Activity, CheckCircle2, MapPin } from 'lucide-svelte';

    // --- RUNES ---
    let { compact = false } = $props();

    let pmrIssues = $state([]);
    let loading = $state(true);

    onMount(async () => {
        const { data } = await supabase.from('pmr_data').select('gare, quai, etat_rampe, rampe_id').in('etat_rampe', ['HS', 'En attente']).order('gare', { ascending: true });
        pmrIssues = data || [];
        loading = false;
    });
</script>

<div class="glass-panel {compact ? 'p-2' : 'p-5'} rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md h-full flex flex-col transition-all duration-300">
    <div class="flex items-center gap-3 {compact ? 'mb-2' : 'mb-4'}">
        {#if !compact}
            <div class="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"><Activity class="w-6 h-6" /></div>
        {:else}
            <Activity class="w-4 h-4 text-red-400" />
        {/if}
        <span class="{compact ? 'text-sm' : 'text-xl'} font-bold text-white">{compact ? 'PMR' : 'Rampes PMR'}</span>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {#if loading}
            <div class="space-y-2 animate-pulse">
                {#each Array(compact ? 2 : 3) as _}
                    <div class="{compact ? 'p-2' : 'p-3'} rounded-xl border border-white/5 bg-white/5">
                        <div class="flex justify-between items-start mb-2">
                            <div class="h-3 w-16 bg-white/10 rounded"></div>
                            <div class="h-3 w-12 bg-white/10 rounded"></div>
                        </div>
                        <div class="h-2 w-10 bg-white/5 rounded"></div>
                    </div>
                {/each}
            </div>
        {:else if pmrIssues.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-green-500/50">
                <CheckCircle2 class="{compact ? 'w-6 h-6' : 'w-10 h-10'} mb-2" />
                <span class="text-xs">Tout est opérationnel.</span>
            </div>
        {:else}
            {#each pmrIssues as issue}
                <a href="/pmr?search={issue.rampe_id || issue.gare}" class="block {compact ? 'p-2' : 'p-3'} rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-white {compact ? 'text-xs' : 'text-sm'}">{issue.gare}</h4>
                        <span class="text-[10px] bg-red-500/20 px-2 rounded text-red-300">{issue.etat_rampe}</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin class="w-3 h-3" /> Quai {issue.quai || '?'}</div>
                </a>
            {/each}
        {/if}
    </div>
</div>