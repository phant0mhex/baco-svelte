<script>
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { Mail, Lock, LogIn, Loader2 } from 'lucide-svelte';

  let email = '';
  let password = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';

  async function handleLogin() {
    loading = true;
    errorMessage = '';
    successMessage = '';

    // 1. Connexion Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorMessage = "Email ou mot de passe incorrect.";
      loading = false;
      return;
    }

    // 2. Vérification Bannissement
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('banned_until')
        .eq('id', data.user.id)
        .single();

      if (profile && profile.banned_until) {
        // Utilisateur banni : on déconnecte tout de suite
        await supabase.auth.signOut();
        errorMessage = "Ce compte a été banni.";
        loading = false;
        return;
      }
      
      // 3. Tout est OK -> Redirection vers l'accueil
      goto('/accueil');

    } catch (err) {
      console.error(err);
      errorMessage = "Erreur de vérification du profil.";
      await supabase.auth.signOut();
      loading = false;
    }
  }

  async function handleResetPassword() {
    if (!email) {
      errorMessage = "Veuillez d'abord saisir votre email.";
      return;
    }

    loading = true;
    errorMessage = '';
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profil` // Rediriger vers profil pour changer le mdp
    });

    if (error) {
      errorMessage = "Erreur lors de l'envoi : " + error.message;
    } else {
      successMessage = "Email de réinitialisation envoyé !";
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>Connexion | BACO</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 font-sans p-4">
  
  <div class="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-sm border border-gray-700">
    
    <div class="mb-8 flex justify-center">
      <img src="/logobaco.png" alt="Logo BACO" class="w-4/5 h-auto object-contain">
    </div>
    
    <form on:submit|preventDefault={handleLogin} class="space-y-4">
      
      <div>
        <label for="email" class="sr-only">Email</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail class="w-5 h-5 text-gray-400" />
          </div>
          <input 
            type="email" 
            id="email" 
            bind:value={email}
            required
            class="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500 transition-colors" 
            placeholder="Email"
          >
        </div>
      </div>
      
      <div>
        <label for="password" class="sr-only">Mot de passe</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock class="w-5 h-5 text-gray-400" />
          </div>
          <input 
            type="password" 
            id="password" 
            bind:value={password}
            required
            class="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500 transition-colors" 
            placeholder="Mot de passe"
          >
        </div>
      </div>
      
      <div class="h-6 text-sm text-center">
        {#if errorMessage}
          <p class="text-red-400">{errorMessage}</p>
        {:else if successMessage}
          <p class="text-green-400">{successMessage}</p>
        {/if}
      </div>
      
      <button 
        type="submit" 
        disabled={loading}
        class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md flex items-center justify-center gap-2
               hover:bg-blue-700 transition-all duration-200
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800
               disabled:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {#if loading}
          <Loader2 class="w-5 h-5 animate-spin" />
          <span>Chargement...</span>
        {:else}
          <LogIn class="w-5 h-5" />
          <span>Connexion</span>
        {/if}
      </button>
      
      <button 
        type="button" 
        on:click={handleResetPassword}
        class="w-full text-sm text-blue-400 hover:text-blue-300 text-center pt-2 hover:underline focus:outline-none"
      >
        Mot de passe oublié ?
      </button>

    </form>
  </div>
</div>