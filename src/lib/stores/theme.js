import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Récupérer le thème stocké ou détecter la préférence système
const storedTheme = browser ? localStorage.getItem('theme') : null;
const systemTheme = browser && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const theme = writable(storedTheme || systemTheme);

// S'abonner pour mettre à jour le <html> et le localStorage
if (browser) {
    theme.subscribe((value) => {
        localStorage.setItem('theme', value);
        if (value === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    });
}