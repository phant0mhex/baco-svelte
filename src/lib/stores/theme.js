import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const themesConfig = {
    // --- CLASSIQUES ---
    default: {
        name: 'Deep Space',
        type: 'default',
        preview: 'linear-gradient(135deg, #3b82f6 0%, #93c5fd 100%)',
        colors: {
            '--color-primary': '59, 130, 246',   // Blue-500
            '--color-glow': '147, 197, 253',     // Blue-300
            '--bg-gradient-from': 'rgba(56, 189, 248, 0.15)',
            '--bg-gradient-to': 'rgba(236, 72, 153, 0.15)',
            '--glass-border': 'rgba(255, 255, 255, 0.1)'
        }
    },
    
    // --- NOUVEAUX THÈMES ---

    ocean: {
        name: 'Lagon Bleu',
        type: 'ocean',
        preview: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', // Cyan vers Bleu
        colors: {
            '--color-primary': '6, 182, 212',    // Cyan-500
            '--color-glow': '103, 232, 249',     // Cyan-300
            '--bg-gradient-from': 'rgba(6, 182, 212, 0.15)', // Cyan
            '--bg-gradient-to': 'rgba(59, 130, 246, 0.2)',   // Bleu Royal
            '--glass-border': 'rgba(6, 182, 212, 0.3)'
        }
    },

    sunset: {
        name: 'Sunset California',
        type: 'sunset',
        preview: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)', // Orange vers Pink
        colors: {
            '--color-primary': '249, 115, 22',   // Orange-500
            '--color-glow': '253, 186, 116',     // Orange-300
            '--bg-gradient-from': 'rgba(249, 115, 22, 0.15)', // Orange
            '--bg-gradient-to': 'rgba(219, 39, 119, 0.2)',    // Rose Vif
            '--glass-border': 'rgba(253, 186, 116, 0.3)'
        }
    },

    forest: {
        name: 'Forêt Boréale',
        type: 'forest',
        preview: 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)', // Emerald vers Dark Green
        colors: {
            '--color-primary': '16, 185, 129',   // Emerald-500
            '--color-glow': '110, 231, 183',     // Emerald-300
            '--bg-gradient-from': 'rgba(16, 185, 129, 0.15)', // Vert Émeraude
            '--bg-gradient-to': 'rgba(13, 148, 136, 0.2)',    // Sarcelle (Teal)
            '--glass-border': 'rgba(110, 231, 183, 0.2)'
        }
    },

    monochrome: {
        name: 'Onyx & Argent',
        type: 'monochrome',
        preview: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)', // Gris Souris
        colors: {
            '--color-primary': '226, 232, 240',  // Slate-200 (Presque blanc)
            '--color-glow': '148, 163, 184',     // Slate-400
            '--bg-gradient-from': 'rgba(148, 163, 184, 0.1)', // Gris léger
            '--bg-gradient-to': 'rgba(71, 85, 105, 0.2)',     // Gris sombre
            '--glass-border': 'rgba(255, 255, 255, 0.15)'     // Bordure très fine blanche
        }
    },

    // --- SPÉCIAUX ---

    cyberpunk: {
        name: 'Cyberpunk Yellow',
        type: 'cyberpunk',
        preview: 'linear-gradient(135deg, #eab308 0%, #10b981 100%)',
        colors: {
            '--color-primary': '234, 179, 8',    // Yellow-500
            '--color-glow': '253, 224, 71',      // Yellow-300
            '--bg-gradient-from': 'rgba(234, 179, 8, 0.15)', // Jaune
            '--bg-gradient-to': 'rgba(16, 185, 129, 0.15)',  // Vert
            '--glass-border': 'rgba(234, 179, 8, 0.3)'
        }
    },

    neon: {
        name: 'Neon Purple',
        type: 'neon',
        preview: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
        colors: {
            '--color-primary': '168, 85, 247',   // Purple-500
            '--color-glow': '216, 180, 254',     // Purple-300
            '--bg-gradient-from': 'rgba(168, 85, 247, 0.2)',
            '--bg-gradient-to': 'rgba(236, 72, 153, 0.2)',
            '--glass-border': 'rgba(168, 85, 247, 0.3)'
        }
    },

    christmas: {
        name: 'Esprit de Noël',
        type: 'christmas',
        preview: 'linear-gradient(135deg, #166534 0%, #b91c1c 100%)',
        colors: {
            '--color-primary': '239, 68, 68',    // Red-500
            '--color-glow': '252, 165, 165',     // Red-300
            '--bg-gradient-from': 'rgba(22, 101, 52, 0.3)',  // Vert sapin
            '--bg-gradient-to': 'rgba(185, 28, 28, 0.2)',    // Rouge
            '--glass-border': 'rgba(255, 255, 255, 0.2)'
        }
    }
};

const storedThemeId = browser ? localStorage.getItem('theme_id') : 'default';
export const currentThemeId = writable(storedThemeId || 'default');

export const applyTheme = (themeId) => {
    if (!browser) return;
    
    const theme = themesConfig[themeId] || themesConfig['default'];
    const root = document.documentElement;

    // 1. Appliquer les variables CSS
    Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    // 2. Gestion des classes pour les effets spécifiques (ex: .theme-christmas)
    // On nettoie les anciennes classes de thème
    Object.values(themesConfig).forEach(t => root.classList.remove(`theme-${t.type}`));
    // On ajoute la nouvelle
    root.classList.add(`theme-${theme.type}`);

    localStorage.setItem('theme_id', themeId);
};

if (browser) {
    currentThemeId.subscribe(applyTheme);
}