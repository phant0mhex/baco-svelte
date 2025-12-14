// --- src/lib/core/layout.js ---

// Vérifie si Notyf est chargé et initialise l'instance.
let notyfInstance;

if (typeof Notyf !== 'undefined') {
    notyfInstance = new Notyf({ 
        duration: 3000, 
        position: { x: 'right', y: 'top' }, 
        dismissible: true 
    });
} else {
    // Mock simple si Notyf n'est pas trouvé (pour éviter de planter)
    notyfInstance = {
        success: (msg) => console.log(`[Notification SUCCESS] ${msg}`),
        error: (msg) => console.error(`[Notification ERROR] ${msg}`)
    };
}

// Exporte l'instance pour l'utilisation dans les composants Svelte
export const notyf = notyfInstance;