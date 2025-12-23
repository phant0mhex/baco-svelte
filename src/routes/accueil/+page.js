export const ssr = false;

export async function load({ parent }) {
    // 1. On récupère la session et le client Supabase depuis le layout racine
    const { supabase, session } = await parent();

    let savedConfig = [];
    let savedTheme = 'default';

    // 2. Si l'utilisateur est connecté, on va chercher ses préférences
    if (session?.user) {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('dashboard_config, theme') // On récupère bien les DEUX colonnes
            .eq('user_id', session.user.id)
            .single();

        if (!error && data) {
            savedConfig = data.dashboard_config || [];
            savedTheme = data.theme || 'default';
        }
    }

    // 3. On renvoie les données à la page (+page.svelte)
    return {
        savedConfig,
        savedTheme,
        session
    };
}