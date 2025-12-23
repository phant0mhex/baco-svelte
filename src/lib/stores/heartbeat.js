// src/lib/stores/heartbeat.js
import { writable } from 'svelte/store';

export const heartbeat = writable(false);

let timeout;

// Fonction à appeler quand une donnée est reçue
export function triggerHeartbeat() {
    heartbeat.set(true);
    
    // On éteint la lumière après 150ms pour faire un flash rapide
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        heartbeat.set(false);
    }, 150);
}