import { onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import { triggerHeartbeat } from '$lib/stores/heartbeat'; // <-- IMPORT AJOUTÉ

/**
 * Hook pour appeler une fonction périodiquement
 * @param {Function} fn - La fonction async à appeler
 * @param {number} intervalMs - L'intervalle en ms
 */
export function usePolling(fn, intervalMs = 60000) {
    let intervalId;

    // Fonction wrapper qui gère le trigger visuel
    const run = async () => {
        if (!browser) return;
        
        // On ne poll pas si l'onglet est caché (économie de ressources)
        if (document.hidden) return;

        try {
            await fn();
            triggerHeartbeat(); // <-- ON DÉCLENCHE LE FLASH SI SUCCÈS
        } catch (error) {
            console.error("Polling error:", error);
            // On pourrait imaginer un triggerHeartbeatError() rouge ici
        }
    };

    onMount(() => {
        if (!browser) return;

        // Appel immédiat
        run();

        // Lancement du cycle
        intervalId = setInterval(run, intervalMs);

        // Réveil quand l'onglet redevient visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                run();
                // On redémarre l'intervalle pour être propre
                clearInterval(intervalId);
                intervalId = setInterval(run, intervalMs);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    });

    onDestroy(() => {
        if (browser) {
            clearInterval(intervalId);
        }
    });
}