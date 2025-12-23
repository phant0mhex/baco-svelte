import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const ssr = false;

// On récupère 'fetch' dans les paramètres de la fonction load
export async function load({ parent, fetch }) {
    const parentData = await parent();
    let session = parentData.session;

    // ASTUCE : On crée un client temporaire qui utilise le fetch de SvelteKit
    // Cela supprime l'erreur "using window.fetch"
    const supabaseLoad = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch: fetch }
    });

    // Si pas de session via le parent, on la récupère proprement avec notre client
    if (!session) {
        const { data } = await supabaseLoad.auth.getSession();
        session = data.session;
    }

    let savedConfig = [];
    let savedTheme = 'default';

    if (session?.user) {
        // On utilise 'supabaseLoad' au lieu de l'import global
        const { data, error } = await supabaseLoad
            .from('user_preferences')
            .select('dashboard_config, theme')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (!error && data) {
            savedConfig = data.dashboard_config || [];
            savedTheme = data.theme || 'default';
        }
    }

    return {
        savedConfig,
        savedTheme,
        session
    };
}