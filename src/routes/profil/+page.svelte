<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { User, Lock, Mail, Save, Loader2 } from 'lucide-svelte';

  let profile = null;
  let email = "";
  let loading = true;
  let saving = false;
  
  // Formulaire mot de passe
  let newPassword = "";
  let confirmPassword = "";

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      email = user.email;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      profile = data;
    }
    loading = false;
  });

  async function updatePassword() {
    if (newPassword !== confirmPassword) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      alert("Le mot de passe est trop court.");
      return;
    }

    saving = true;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    saving = false;

    if (error) alert("Erreur: " + error.message);
    else {
      alert("Mot de passe mis à jour !");
      newPassword = "";
      confirmPassword = "";
    }
  }
</script>

<svelte:head>
  <title>Mon Profil | BACO</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-8">
  <h1 class="text-3xl font-bold text-gray-800 dark:text-white">Mon Profil</h1>

  {#if loading}
    <div class="text-center text-gray-500">Chargement...</div>
  {:else if profile}
    
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-6">
        <div class="relative group cursor-pointer">
          <img 
            src={profile.avatar_url || 'https://via.placeholder.com/100'} 
            alt="Avatar" 
            class="w-24 h-24 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700"
          >
          <div class="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-white text-xs">Modifier</span>
          </div>
        </div>
        
        <div class="flex-grow">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{profile.full_name || 'Utilisateur'}</h2>
          <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-1">
            <Mail class="w-4 h-4" />
            <span>{email}</span>
          </div>
          <div class="mt-4 inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
            {profile.role || 'Membre'}
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Lock class="w-5 h-5" /> Sécurité
      </h3>
      
      <div class="space-y-4 max-w-md">
        <div>
          <label for="new-pass" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nouveau mot de passe</label>
          <input 
            id="new-pass"
            type="password" 
            bind:value={newPassword}
            class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
          >
        </div>
        <div>
          <label for="conf-pass" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirmer le mot de passe</label>
          <input 
            id="conf-pass"
            type="password" 
            bind:value={confirmPassword}
            class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
          >
        </div>

        <button 
          on:click={updatePassword}
          disabled={saving || !newPassword}
          class="flex items-center justify-center gap-2 w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if saving}
            <Loader2 class="w-4 h-4 animate-spin" /> Mise à jour...
          {:else}
            <Save class="w-4 h-4" /> Mettre à jour le mot de passe
          {/if}
        </button>
      </div>
    </div>

  {/if}
</div>