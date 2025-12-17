<script>
    import { confirmModal, closeConfirmModal } from '$lib/stores/modal.js';
    import { fly, fade } from 'svelte/transition';
    import { AlertTriangle, X } from 'lucide-svelte';

    // Gère l'action de confirmation
    function handleConfirm() {
        if ($confirmModal.callback) {
            $confirmModal.callback(); 
        }
        closeConfirmModal();
    }

    // Gestion de la fermeture par la touche Échap
    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            closeConfirmModal();
        }
    }
</script>

{#if $confirmModal.isOpen}
    <div 
        class="fixed inset-0 z-[1010] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        transition:fade|local={{ duration: 200 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        on:click|self={closeConfirmModal} 
        on:keydown={handleKeyDown}
        tabindex="-1"
    >
        <div 
            class="bg-[#0f1115] border border-white/10 ring-1 ring-white/5 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all"
            transition:fly|local={{ y: 20, duration: 300 }}
        >
            <div class="p-6">
                <div class="flex items-start gap-4">
                    
                    <div class="flex-shrink-0 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <AlertTriangle class="h-6 w-6 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" aria-hidden="true" />
                    </div>
                    
                    <div class="flex-grow pt-1">
                        <h3 id="modal-title" class="text-lg font-bold text-gray-100 mb-2 leading-tight">
                            Confirmer l'Action
                        </h3>
                        <p class="text-sm text-gray-400 leading-relaxed">
                            {$confirmModal.message}
                        </p>
                    </div>

                    <button 
                        on:click={closeConfirmModal}
                        class="text-gray-500 hover:text-white transition-colors flex-shrink-0 -mt-2 -mr-2 p-2 hover:bg-white/5 rounded-lg"
                    >
                        <X class="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div class="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex justify-end gap-3">
                
                <button
                    on:click={closeConfirmModal}
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-all"
                >
                    Annuler
                </button>

                <button
                    on:click={handleConfirm}
                    type="button"
                    class="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 border border-red-500/30 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all hover:scale-105 active:scale-95"
                >
                    Confirmer
                </button>
            </div>
        </div>
    </div>
{/if}