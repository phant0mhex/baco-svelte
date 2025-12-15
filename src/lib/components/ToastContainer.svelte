<script>
    import { toasts, dismissToast } from '$lib/stores/toast.js';
    import { fade } from 'svelte/transition';

    // Import des icônes Lucide spécifiques
    import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte'; 

    /**
     * Retourne les classes Tailwind et le composant icône pour chaque type de toast.
     */
    function getStyle(type) {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-500',
                    border: 'border-green-600',
                    icon: CheckCircle, // Composant Lucide
                };
            case 'error':
                return {
                    bg: 'bg-red-600',
                    border: 'border-red-700',
                    icon: XCircle, // Composant Lucide
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-500',
                    border: 'border-yellow-600',
                    icon: AlertTriangle, // Composant Lucide
                };
            case 'info':
            default:
                return {
                    bg: 'bg-blue-500',
                    border: 'border-blue-600',
                    icon: Info, // Composant Lucide
                };
        }
    }
</script>

<div class="fixed top-4 right-4 z-[1000] space-y-3 pointer-events-none">
    
    {#each $toasts as t (t.id)}
        
        <div 
            in:fade={{ duration: 150 }} 
            out:fade={{ duration: 150 }}
            class="
                w-full max-w-sm p-4 rounded-lg shadow-lg text-white 
                {getStyle(t.type).bg} border-l-4 {getStyle(t.type).border} 
                flex items-start justify-between space-x-4
                pointer-events-auto
            "
        >
            <div class="flex items-start space-x-3">
                
                <svelte:component this={getStyle(t.type).icon} class="w-5 h-5 mt-0.5 flex-shrink-0" />
                
                <p class="text-sm font-medium">{t.message}</p>
            </div>

            <button 
                on:click={() => dismissToast(t.id)}
                class="text-white/70 hover:text-white transition-colors flex-shrink-0 p-1 rounded-full hover:bg-white/10"
                aria-label="Fermer la notification"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {/each}
</div>