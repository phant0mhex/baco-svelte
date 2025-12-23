<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { BookCopy, Search, X } from 'lucide-svelte'; // Ajout icônes
    import { slide } from 'svelte/transition'; // Ajout transition

    // --- RUNES ---
    let { compact = false } = $props();

    let entries = $state([]);
    let loading = $state(true);
    
    // --- ÉTAT RECHERCHE ---
    let isSearchOpen = $state(false);
    let searchQuery = $state("");

    // --- FILTRAGE RÉACTIF ---
    let filteredEntries = $derived.by(() => {
        // Si pas de recherche, on renvoie tout
        if (!searchQuery.trim()) return entries;

        const q = searchQuery.toLowerCase();
        return entries.filter(e => 
            // Recherche dans le contenu du message
            (e.message_content && e.message_content.toLowerCase().includes(q)) ||
            // Recherche dans le nom de l'auteur
            (e.profiles?.full_name && e.profiles.full_name.toLowerCase().includes(q))
        );
    });

    onMount(async () => {
        // J'ai augmenté la limite à 15 pour que la recherche locale soit utile
        // (Chercher dans seulement 3 items n'a pas beaucoup de sens)
        const { data } = await supabase
            .from('main_courante')
            .select(`*, profiles(full_name, avatar_url)`)
            .order('created_at', { ascending: false })
            .limit(15); 
            
        entries = data || [];
        loading = false;
    });

    const formatLogDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
</script>

<div class="glass-panel {compact ? 'p-2' : 'p-4'} rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md h-full flex flex-col transition-all duration-300 group">
    
    <div class="flex justify-between items-center {compact ? 'mb-2' : 'mb-3'} shrink-0 h-8">
        
        {#if !isSearchOpen || !compact}
            <div class="flex items-center gap-3 animate-in fade-in duration-200">
                {#if !compact}
                    <div class="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                        <BookCopy class="w-5 h-5" />
                    </div>
                {:else}
                    <BookCopy class="w-4 h-4 text-yellow-400" />
                {/if}
                <span class="{compact ? 'text-sm' : 'text-lg'} font-bold text-white">Journal</span>
            </div>
        {/if}

        <div class="flex items-center gap-2 ml-auto">
            {#if isSearchOpen}
                <div class="flex items-center bg-white/10 rounded-lg border border-white/10 overflow-hidden" transition:slide={{ axis: 'x', duration: 300 }}>
                    <input 
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Mot-clé..."
                        class="bg-transparent border-none text-white text-xs px-2 py-1 w-28 focus:ring-0 placeholder-white/30 focus:outline-none"
                        autofocus
                    />
                    <button 
                        onclick={() => { searchQuery = ""; isSearchOpen = false; }}
                        class="p-1 hover:text-white text-gray-400"
                    >
                        <X size={14} />
                    </button>
                </div>
            {:else}
                <button 
                    onclick={() => isSearchOpen = true}
                    class="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg"
                    title="Rechercher dans le journal"
                >
                    <Search size={compact ? 14 : 16} />
                </button>
            {/if}
        </div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {#if loading}
            <div class="space-y-3 animate-pulse">
                {#each Array(3) as _}
                    <div class="bg-white/5 border border-white/5 rounded-xl {compact ? 'p-2' : 'p-3'}">
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
        
        {:else if filteredEntries.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-gray-500 py-4 opacity-60">
                {#if searchQuery}
                    <Search class="w-6 h-6 mb-1" />
                    <span class="text-xs">Aucun résultat.</span>
                {:else}
                    <span class="text-sm">Journal vide.</span>
                {/if}
            </div>
        
        {:else}
            {#each filteredEntries as entry (entry.id)}
                <div class="bg-white/[0.03] border border-white/5 rounded-xl {compact ? 'p-2' : 'p-3'} hover:bg-white/[0.07] transition-colors group/item">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-200 {compact ? 'text-[10px]' : 'text-xs'}">
                            {entry.profiles?.full_name || 'Inconnu'}
                        </span>
                        <span class="text-[9px] text-gray-500 bg-black/20 px-1.5 rounded whitespace-nowrap">
                            {formatLogDate(entry.created_at)}
                        </span>
                    </div>
                    <p class="text-gray-300 {compact ? 'text-[10px] line-clamp-2' : 'text-xs line-clamp-3'} break-words leading-relaxed">
                        {entry.message_content}
                    </p>
                </div>
            {/each}
        {/if}
    </div>

    {#if !compact && !searchQuery}
        <div class="mt-2 pt-2 border-t border-white/5 text-center">
            <a href="/journal" class="text-xs font-bold text-yellow-400/80 hover:text-yellow-300 transition-colors flex items-center justify-center gap-1">
                Voir l'historique complet
            </a>
        </div>
    {/if}
</div>