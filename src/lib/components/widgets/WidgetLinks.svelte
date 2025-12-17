<script>
    import { 
        Shield, Accessibility, Users, Bus, Car, BookUser, 
        Train, Folder, Tag, Zap, ArrowUpRight
    } from 'lucide-svelte';

    // Vos liens originaux
    const items = [
        { href: '/operationnel', icon: Shield, label: 'Opérationnel', color: 'text-blue-400', glow: 'rgba(96,165,250,0.8)', desc: 'Procédures' },
        { href: '/pmr', icon: Accessibility, label: 'Rampes', color: 'text-red-400', glow: 'rgba(248,113,113,0.8)', desc: 'État' },
        { href: '/clients-pmr', icon: Users, label: 'Clients', color: 'text-purple-400', glow: 'rgba(192,132,252,0.8)', desc: 'Détails' },
        { href: '/bus', icon: Bus, label: 'Bus', color: 'text-yellow-400', glow: 'rgba(250,204,21,0.8)', desc: 'Sociétés bus' },
        { href: '/taxi', icon: Car, label: 'Taxi', color: 'text-orange-400', glow: 'rgba(251,146,60,0.8)', desc: 'Sociétés taxis' },
        { href: '/repertoire', icon: BookUser, label: 'Répertoire', color: 'text-green-400', glow: 'rgba(74,222,128,0.8)', desc: 'Contacts' },
        { href: '/lignes', icon: Train, label: 'Lignes', color: 'text-cyan-400', glow: 'rgba(34,211,238,0.8)', desc: 'Infos' },
        { href: '/documents', icon: Folder, label: 'Docs', color: 'text-gray-400', glow: 'rgba(156,163,175,0.8)', desc: 'Archives' },
        { href: '/ptcar', icon: Tag, label: 'PtCar', color: 'text-indigo-400', glow: 'rgba(129,140,248,0.8)', desc: 'Codes Tel.' }
    ];

    const getNeonStyle = (color) => `group-hover:drop-shadow-[0_0_8px_${color}]`;
</script>

<div class="glass-panel p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md h-full flex flex-col relative overflow-hidden">
    
    <div class="flex items-center gap-2 mb-4 z-10">
        <div class="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Zap class="w-5 h-5" />
        </div>
        <h2 class="text-lg font-bold text-white">Accès Rapide</h2>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 content-start overflow-y-auto custom-scrollbar pr-1">
        {#each items as item}
            <a href={item.href} class="relative flex flex-col items-center justify-center p-3 rounded-xl bg-black/20 border border-white/5 hover:bg-white/5 hover:border-white/20 transition-all hover:-translate-y-1 group h-24">
                
                <svelte:component 
                    this={item.icon} 
                    class="w-6 h-6 {item.color} mb-2 transition-transform duration-300 group-hover:scale-110" 
                    style="filter: drop-shadow(0 0 0 rgba(0,0,0,0)); {item.glow ? `transition: filter 0.3s;` : ''}"
                />
                
                <span class="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
                
                {#if item.desc}
                    <span class="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5 group-hover:text-gray-400">{item.desc}</span>
                {/if}

                <ArrowUpRight class="absolute top-2 right-2 w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
        {/each}
    </div>
</div>

<style>
    /* Effet néon manuel au survol via CSS global ou inline si besoin de support dynamique */
    a:hover svg {
        filter: drop-shadow(0 0 5px currentColor);
    }
</style>