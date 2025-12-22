<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { BookCopy } from 'lucide-svelte';

    let entries = [];
    let loading = true;

    onMount(async () => {
        const { data } = await supabase.from('main_courante').select(`*, profiles(full_name, avatar_url)`).order('created_at', { ascending: false }).limit(3);
        entries = data || [];
        loading = false;
    });

    const formatLogDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
</script>

<div class="glass-panel p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md h-full flex flex-col">
    <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"><BookCopy class="w-6 h-6" /></div>
        <span class="text-xl font-bold text-white">Journal</span>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {#if loading}
            <div class="space-y-3 animate-pulse">
                {#each Array(3) as _}
                    <div class="bg-white/5 border border-white/5 rounded-xl p-3">
                        <div class="flex justify-between items-center mb-2">
                            <div class="h-3 w-24 bg-white/10 rounded"></div>
                            <div class="h-3 w-12 bg-white/5 rounded"></div>
                        </div>
                        <div class="space-y-1">
                            <div class="h-2 w-full bg-white/5 rounded"></div>
                            <div class="h-2 w-3/4 bg-white/5 rounded"></div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if entries.length === 0}
            <div class="text-center text-gray-500 text-sm py-4">Journal vide.</div>
        {:else}
            {#each entries as entry}
                <div class="bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:bg-white/[0.07] transition-colors">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-200 text-xs">{entry.profiles?.full_name}</span>
                        <span class="text-[9px] text-gray-500 bg-black/20 px-1.5 rounded">{formatLogDate(entry.created_at)}</span>
                    </div>
                    <p class="text-gray-300 text-xs line-clamp-2">{entry.message_content}</p>
                </div>
            {/each}
        {/if}
    </div>
    <a href="/journal" class="text-xs font-bold text-blue-400 text-center mt-2 hover:underline">Voir tout</a>
</div>