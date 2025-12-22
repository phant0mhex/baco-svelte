import { writable } from 'svelte/store';

// L'état initial est un tableau vide de notifications
const initialState = [];

// Crée le store writable
export const toasts = writable(initialState);

/**
 * Envoie une notification (toast) à l'application.
 * @param {string} message - Le message à afficher.
 * @param {'success' | 'error' | 'warning' | 'info'} type - Le type de notification.
 * @param {number} duration - Durée d'affichage en millisecondes (par défaut : 3000ms).
 */
export function sendToast(message, type = 'info', duration = 3000) {
    // CORRECTION : Utiliser crypto.randomUUID() au lieu de Date.now()
    const id = crypto.randomUUID(); 

    const newToast = {
        id,
        message,
        type,
        duration,
    };

    // Ajoute la nouvelle notification à la liste
    toasts.update((currentToasts) => [...currentToasts, newToast]);

    // Planifie la suppression de la notification après la durée spécifiée
    setTimeout(() => {
        dismissToast(id);
    }, duration);
}

/**
 * Supprime une notification spécifique.
 * @param {string} id - L'ID du toast à supprimer.
 */
export function dismissToast(id) {
    toasts.update((currentToasts) =>
        currentToasts.filter((t) => t.id !== id)
    );
}

// Raccourcis pour faciliter l'utilisation
export const toast = {
    success: (message, duration) => sendToast(message, 'success', duration),
    error: (message, duration) => sendToast(message, 'error', duration),
    warning: (message, duration) => sendToast(message, 'warning', duration),
    info: (message, duration) => sendToast(message, 'info', duration),
};