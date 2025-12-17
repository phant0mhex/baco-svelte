<script>
    import { toasts, dismissToast } from '$lib/stores/toast.js';
    import { fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';

    // Import des icônes Lucide spécifiques
    import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte'; 

    /**
     * Retourne les styles Glassmorphic pour chaque type
     */
    function getStyle(type) {
        switch (type) {
            case 'success':
                return {
                    // Fond teinté vert + Bordure verte subtile + Ombre verte légère
                    container: 'bg-green-500/20 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]',
                    textColor: 'text-green-100',
                    iconColor: 'text-green-400',
                    icon: CheckCircle,
                };
            case 'error':
                return {
                    container: 'bg-red-500/20 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
                    textColor: 'text-red-100',
                    iconColor: 'text-red-400',
                    icon: XCircle,
                };
            case 'warning':
                return {
                    container: 'bg-yellow-500/20 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
                    textColor: 'text-yellow-100',
                    iconColor: 'text-yellow-400',
                    icon: AlertTriangle,
                };
            case 'info':
            default:
                return {
                    container: 'bg-blue-500/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
                    textColor: 'text-blue-100',
                    iconColor: 'text-blue-400',
                    icon: Info,
                };
        }
    }
</script>

<div class="fixed top-4 right-4 z-[1000] space-y-3 pointer-events-none flex flex-col items-end p-4">
    
    {#each $toasts as t (t.id)}
        {@const style = getStyle(t.type)}
        
        <div 
            in:fly={{ x: 20, duration: 300, easing: quintOut }} 
            out:fly={{ opacity: 0, duration: 200 }}
            class="
                pointer-events-auto
                w-full max-w-sm p-4 rounded-2xl border
                backdrop-blur-xl
                flex items-start justify-between gap-4
                shadow-lg transition-all
                {style.container}
            "
        >
            <div class="flex items-start gap-3">
                
                <div class="flex-shrink-0 mt-0.5 {style.iconColor}">
                    <svelte:component this={style.icon} size={20} />
                </div>
                
                <p class="text-sm font-medium {style.textColor} leading-snug pt-0.5">
                    {t.message}
                </p>
            </div>

            <button 
                on:click={() => dismissToast(t.id)}
                class="flex-shrink-0 p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fermer"
            >
                <X size={16} />
            </button>
        </div>
    {/each}
</div>