<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores'; 
  import { ACTIONS, ROLE_DEFAULTS } from '$lib/permissions';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { fly, fade, slide } from 'svelte/transition';
  import { 
    User, Mail, Shield, Camera, Lock, Save, 
    FileWarning, AlertOctagon, Loader2, CheckCircle,
    Tag, Cake, ChevronLeft, Copy, KeyRound, UserX, UserCheck,
    Plus, X, History, AlertTriangle, ArrowUpDown, UserPlus, ShieldAlert, UserCog
  } from 'lucide-svelte';
  
  import { toast } from '$lib/stores/toast.js';

  // --- ÉTAT (Runes) ---
  let isLoading = $state(true);
  let isSaving = $state(false);
  let isUploading = $state(false);
  
  // Gestion du tri
  let sortCol = $state('last_active'); // Colonne par défaut
  let sortAsc = $state(false);         // Ordre par défaut (Descendant = plus récent en premier)

  let targetUserId = $derived($page.params.id);
  
  let profileData = $state({
    username: "",
    full_name: "",
    email: "", 
    role: "user",
    fonction: "", 
    birthday: null, 
    avatar_url: null,
    banned_until: null,
    permissions: {}
  });

  let users = $state([]); // Utilisation de $state pour le tableau principal
  let infractions = $state([]);
  let trustScore = $state(100);
  let trustColor = $state("bg-green-500");
  let trustLabel = $state("Chargement...");
  let showInfractionModal = $state(false);
  let infractionData = $state({ type: 'yellow', reason: '' });
  let generatedPassword = $state("");
  let resetLoading = $state(false);
  let infractionLoading = $state(false);

  // Variables pour la création
  let newUser = $state({ email: "", password: "", role: "user" });
  let isCreating = $state(false);
  let currentAdminId = $state(null);
  
  // Pour l'édition ciblée (simulé depuis la liste si besoin)
  // Note: Dans votre code précédent, targetUser servait à l'affichage conditionnel. 
  // Ici je garde la logique: si targetUserId (URL) existe -> Mode Edit, sinon -> Mode Liste
  let targetUser = $derived(targetUserId ? users.find(u => u.user_id === targetUserId) : null);

  // --- TRI AUTOMATIQUE ($derived) ---
  let sortedUsers = $derived(
      [...users].sort((a, b) => {
          let valA = a[sortCol];
          let valB = b[sortCol];

          // Gestion spécifique pour les dates et textes
          if (sortCol === 'last_active') {
              valA = new Date(valA || 0).getTime();
              valB = new Date(valB || 0).getTime();
          } else if (typeof valA === 'string') {
              valA = valA.toLowerCase();
              valB = valB.toLowerCase();
          }

          if (valA < valB) return sortAsc ? -1 : 1;
          if (valA > valB) return sortAsc ? 1 : -1;
          return 0;
      })
  );

  onMount(async () => {
    await checkAdminAccess();
    if (!targetUserId) {
        await loadUsers();
    } else {
        await loadProfileData();
    }
  });

  function toggleSort(col) {
      if (sortCol === col) {
          sortAsc = !sortAsc;
      } else {
          sortCol = col;
          sortAsc = true;
      }
  }

  async function checkAdminAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return goto('/');
    currentAdminId = user.id;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return goto('/');
  }

  // --- CHARGEMENT UTILISATEURS (CORRIGÉ POUR LAST SEEN) ---
  async function loadUsers() {
    isLoading = true;
    try {
      // 1. Récupérer les utilisateurs via RPC
      const { data: usersData, error } = await supabase.rpc('get_all_users'); 
      if (error) throw error;

      // 2. Récupérer les "VRAIES" dernières connexions depuis user_presence
      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('user_id, last_seen_at');

      // 3. Fusionner les données
      const presenceMap = new Map(presenceData?.map(p => [p.user_id, p.last_seen_at]));

      users = (usersData || []).map(u => {
          // On prend la date la plus récente entre auth.last_sign_in et presence.last_seen
          const lastSeen = presenceMap.get(u.user_id);
          const lastSignIn = u.last_sign_in_at;
          
          let realLastActive = lastSignIn;
          // Si lastSeen existe et est plus récent (ou si lastSignIn est null)
          if (lastSeen && (!lastSignIn || new Date(lastSeen) > new Date(lastSignIn))) {
              realLastActive = lastSeen;
          }

          return {
              ...u,
              last_active: realLastActive // Nouvelle propriété unifiée
          };
      });

    } catch (e) {
      toast.error("Erreur: " + e.message);
    } finally {
      isLoading = false;
    }
  }

  async function loadProfileData() {
    isLoading = true;
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', targetUserId).single();
        if (error) throw error;
        Object.assign(profileData, data);
        if (!profileData.permissions) profileData.permissions = {};
        
        const { data: email } = await supabase.rpc('admin_get_user_email', { p_user_id: targetUserId });
        profileData.email = email || "Non accessible";
        
        await loadInfractions();
    } catch (e) {
        console.error("Erreur chargement:", e);
        toast.error("Impossible de charger ce profil.");
    } finally {
        isLoading = false;
    }
  }

  // --- ACTIONS (Sauvegarde, Création, etc.) ---
  
  async function handleUpdateProfile() {
    isSaving = true;
    try {
      const updates = {
        username: profileData.username,
        full_name: profileData.full_name,
        birthday: profileData.birthday, 
        fonction: profileData.fonction, 
        permissions: profileData.permissions,
        role: profileData.role, 
        updated_at: new Date()
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', targetUserId);
      if (error) throw error;
      toast.success("Profil mis à jour avec succès !");
    } catch (e) {
      toast.error("Erreur: " + e.message);
    } finally {
      isSaving = false;
    }
  }

  async function handleCreateUser() {
    if (!newUser.email || !newUser.password) return;
    isCreating = true;
    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) throw new Error("Session admin perdue.");

      const { error: signUpError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            role: newUser.role,
            full_name: newUser.email.split('@')[0],
            username: newUser.email.split('@')[0]
          }
        }
      });

      if (signUpError) throw signUpError;
      
      // Restauration session admin car signUp connecte le nouveau user
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });

      toast.success(`Utilisateur créé !`);
      newUser = { email: "", password: "", role: "user" };
      await loadUsers();
    } catch (e) {
      toast.error("Erreur: " + e.message);
      // Si session perdue, reload
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) location.reload();
    } finally {
      isCreating = false;
    }
  }

  // --- LOGIQUE UI PERMISSIONS ---
  function getPermissionState(action) {
    const custom = profileData.permissions?.[action];
    const roleHasIt = ROLE_DEFAULTS[profileData.role]?.includes(action);
    if (custom === true) return 'granted';
    if (custom === false) return 'denied';
    return roleHasIt ? 'inherited_yes' : 'inherited_no';
  }

  function togglePermission(action) {
    if (!profileData.permissions) profileData.permissions = {};
    const currentState = getPermissionState(action);
    if (currentState === 'inherited_yes') profileData.permissions[action] = false; 
    else if (currentState === 'inherited_no') profileData.permissions[action] = true; 
    else if (currentState === 'granted') profileData.permissions[action] = false; 
    else if (currentState === 'denied') delete profileData.permissions[action];
  }

  // --- GESTION AVATAR ---
  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    isUploading = true;
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${targetUserId}/${Math.random()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicURL = urlData.publicUrl;
      const { error: dbError } = await supabase.from('profiles').update({ avatar_url: publicURL, updated_at: new Date() }).eq('id', targetUserId);
      if (dbError) throw dbError;
      profileData.avatar_url = publicURL;
      toast.success("Avatar mis à jour !");
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'upload.");
    } finally {
      isUploading = false;
    }
  }

  // --- GESTION DES SANCTIONS ---
  function openAddInfraction() {
      infractionData = { type: 'yellow', reason: '' };
      showInfractionModal = true;
  }

  async function submitInfraction() {
      if (!infractionData.reason) return toast.warning("Le motif est obligatoire.");
      infractionLoading = true;
      try {
          const { error } = await supabase.rpc('admin_add_infraction', {
              target_user_id: targetUserId, // Pour le mode profil
              p_card_type: infractionData.type,
              p_reason: infractionData.reason
          });
          if (error) throw error;
          toast.success("Sanction appliquée !");
          showInfractionModal = false;
          await loadInfractions(); 
      } catch (e) {
          toast.error("Erreur: " + e.message);
      } finally {
          infractionLoading = false;
      }
  }

  async function pardonInfraction(infractionId) {
      if (!confirm("Voulez-vous pardonner cette sanction ?")) return;
      try {
          const { error } = await supabase.rpc('admin_pardon_infraction', { p_infraction_id: infractionId });
          if (error) throw error;
          toast.success("Sanction pardonnée.");
          await loadInfractions(); 
      } catch (e) {
          toast.error("Erreur: " + e.message);
      }
  }

  function openInfractionModalList(user) {
      // Version liste : on doit rediriger vers le profil ou adapter la logique
      // Ici pour simplifier on redirige vers le profil pour gérer les sanctions
      goto(`/admin/utilisateur/${user.user_id}`);
  }

  // --- ACTIONS ADMIN (RESET & BAN) ---
  async function handleResetPassword(userParam = null) {
    if (!confirm("Générer un nouveau mot de passe ?")) return;
    resetLoading = true;
    const uid = userParam?.user_id || targetUserId;
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    const newPass = Array(12).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');

    try {
        const { error } = await supabase.rpc('admin_reset_user_password', {
            user_id_to_reset: uid,
            new_password: newPass
        });
        if (error) throw error;
        generatedPassword = newPass;
        toast.success("Nouveau mot de passe généré !");
        // Si c'était depuis la liste, on peut afficher une petite alerte ou modal (simplifié ici)
        if (userParam) alert(`Mot de passe pour ${userParam.email}: ${newPass}`);
    } catch (e) {
        toast.error("Erreur reset: " + e.message);
    } finally {
        resetLoading = false;
    }
  }

  async function toggleBan(userParam = null) {
    // Si userParam est fourni (liste), on l'utilise, sinon on utilise les données du profil chargé
    const isProfileMode = !!targetUserId;
    const user = userParam || { user_id: targetUserId, banned_until: profileData.banned_until };
    
    const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
    const action = isBanned ? "Débannir" : "Bannir";
    
    if (!confirm(`${action} cet utilisateur ?`)) return;

    try {
        const updates = {
            banned_until: isBanned ? null : new Date(new Date().setFullYear(new Date().getFullYear() + 100)).toISOString(),
            banned_until_status: isBanned ? null : 'banned'
        };

        const { error } = await supabase.from('profiles').update(updates).eq('id', user.user_id);
        if (error) throw error;
        
        toast.success(`Utilisateur ${isBanned ? 'débanni' : 'banni'} !`);
        
        if (isProfileMode) {
            profileData.banned_until = updates.banned_until;
            loadInfractions();
        } else {
            loadUsers();
        }
    } catch(e) {
        toast.error("Erreur: " + e.message);
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(generatedPassword);
    toast.success("Mot de passe copié !");
  }

  // --- LOGIQUE TRUST METER ---
  async function loadInfractions() {
    const { data } = await supabase
      .from('infractions')
      .select('*, admin:admin_id(full_name)')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });
    
    infractions = data || [];
    calculateTrustScore();
  }

  function calculateTrustScore() {
    const activeInfractions = infractions.filter(i => i.is_active);
    if (activeInfractions.length === 0) {
      trustScore = 100;
      trustColor = "bg-gradient-to-r from-green-400 to-green-600 shadow-[0_0_15px_rgba(34,197,94,0.4)]";
      trustLabel = "Dossier impeccable !";
      return;
    }
    let yellow = 0, red = 0;
    const MAX_POINTS = 6;
    activeInfractions.forEach(i => {
      if (i.card_type === 'yellow') yellow++;
      if (i.card_type === 'red') red++;
    });
    
    const totalPoints = (red * MAX_POINTS) + yellow;
    let percentage = 100 - ((totalPoints / MAX_POINTS) * 100);
    if (percentage < 0) percentage = 0;
    trustScore = Math.round(percentage);

    if (totalPoints < 3) {
      trustColor = "bg-gradient-to-r from-yellow-300 to-yellow-500";
      trustLabel = "Attention (Moyen)";
    } else if (totalPoints < 6) {
      trustColor = "bg-gradient-to-r from-orange-500 to-orange-600";
      trustLabel = "Niveau Bas";
    } else {
      trustColor = "bg-gradient-to-r from-red-600 to-red-700";
      trustLabel = "Critique";
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Jamais';
    return new Date(dateStr).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // UI Helpers pour la liste
  function getNextRole(current) {
    if (current === 'user') return { role: 'moderator', icon: Shield, label: 'Promouvoir Modérateur', color: 'text-purple-400' };
    if (current === 'moderator') return { role: 'admin', icon: ShieldAlert, label: 'Promouvoir Admin', color: 'text-themed' };
    return { role: 'user', icon: User, label: 'Rétrograder User', color: 'text-yellow-400' };
  }

  async function handleChangeRole(user, nextRole) {
      if (!confirm(`Changer le rôle en ${nextRole.toUpperCase()} ?`)) return;
      try {
          const { error } = await supabase.rpc('admin_update_user_role', {
              p_user_id: user.user_id,
              p_new_role: nextRole
          });
          if (error) throw error;
          toast.success("Rôle mis à jour.");
          loadUsers();
      } catch (e) { toast.error(e.message); }
  }

  const inputClass = "block w-full rounded-xl border-white/10 bg-black/40 p-3 text-sm font-medium text-white placeholder-gray-600 focus:ring-2 focus:border-transparent transition-all outline-none disabled:opacity-50";
  const labelClass = "block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 ml-1";

  let borderClass = $derived(profileData.role === 'admin' 
      ? 'bg-gradient-to-br from-yellow-300/80 via-amber-400/50 to-yellow-500/80 shadow-[0_0_35px_rgba(245,158,11,0.6)] ring-1 ring-yellow-400/50' 
      : profileData.role === 'moderator'
      ? 'bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-[0_0_30px_rgba(168,85,247,0.6)] animate-pulse' 
      : 'bg-gradient-to-br from-[rgba(var(--color-primary),0.5)] to-purple-500/50 shadow-[0_0_30px_rgba(var(--color-primary),0.2)]'
  );

</script>

<div class="container mx-auto p-4 md:p-8 space-y-8 min-h-screen">
  
<header class="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-white/5 pb-6" in:fly={{ y: -20, duration: 600 }} style="--primary-rgb: var(--color-primary);">
    <div class="flex items-center gap-3">
        {#if targetUserId}
            <button on:click={() => goto('/admin')} class="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors mr-2">
                <ChevronLeft size={24} />
            </button>
        {/if}
        <div class="p-3 rounded-xl border transition-all duration-500"
             style="background-color: rgba(var(--primary-rgb), 0.1); color: rgb(var(--primary-rgb)); border-color: rgba(var(--primary-rgb), 0.2); box-shadow: 0 0 15px rgba(var(--primary-rgb), 0.15);">
          <Shield size={32} />
        </div>
        <div>
          <h1 class="text-3xl font-bold text-gray-200 tracking-tight flex items-center gap-3">
            {#if targetUserId}
                Édition : <span style="color: rgb(var(--primary-rgb));">{profileData.full_name || 'Utilisateur'}</span>
                {#if profileData.role === 'admin'}
                  <span class="inline-flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs font-bold rounded-full uppercase border border-yellow-500/30">Admin</span>
                {/if}
            {:else}
                Administration
            {/if}
          </h1>
          <p class="text-gray-500 text-sm mt-1">Gestion complète du profil et des sanctions.</p>
        </div>
    </div>
 </header>

 {#if isLoading && !targetUserId}
    <div class="flex justify-center py-20"><Loader2 class="animate-spin w-10 h-10 themed-spinner" style="color: rgba(var(--color-primary), 0.5);" /></div>
 
 {:else if targetUserId}
    <main class="grid grid-cols-1 lg:grid-cols-2 gap-8" style="--primary-rgb: var(--color-primary);">
      
      <div class="space-y-8" in:fly={{ x: -20, duration: 600, delay: 100 }}>
        
        <div class="bg-black/20 border border-white/5 rounded-3xl p-8 relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-32 opacity-20 pointer-events-none"
               style="background: linear-gradient(to b, rgb(var(--color-primary)), transparent);"></div>

         <div class="relative flex flex-col items-center mb-8">
            <div class="relative group">
                <div class="w-36 h-36 rounded-full p-1 transition-all duration-500 {borderClass}">
                    <img src={profileData.avatar_url || 'https://via.placeholder.com/150'} alt="Avatar" class="w-full h-full rounded-full object-cover border-4 border-[#0f1115]">
                </div>
                <label class="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white backdrop-blur-sm m-1">
                    {#if isUploading} <Loader2 class="animate-spin w-8 h-8"/> {:else} <Camera size={32} /> {/if}
                    <input type="file" class="hidden" accept="image/*" on:change={handleAvatarUpload} disabled={isUploading}>
                </label>
            </div>
            
            <h2 class="text-2xl font-bold text-white mt-4">{profileData.full_name || 'Sans Nom'}</h2>
            <div class="flex items-center gap-2 mt-1">
                <p class="text-gray-400 text-sm">{profileData.email}</p>
                <p class="text-gray-600 text-xs bg-black/40 px-2 py-0.5 rounded font-mono select-all">{targetUserId}</p>
            </div>
          </div>

          <div class="space-y-6">
            <div class="grid grid-cols-1 gap-5">
              <div>
                <label class={labelClass}>Username</label>
                <div class="relative">
                    <User size={16} class="absolute left-3 top-3.5 text-gray-500" />
                    <input type="text" bind:value={profileData.username} class="{inputClass} pl-10" style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);">
                </div>
              </div>
              <div>
                <label class={labelClass}>Nom Complet</label>
                <div class="relative">
                    <Tag size={16} class="absolute left-3 top-3.5 text-gray-500" />
                    <input type="text" bind:value={profileData.full_name} class="{inputClass} pl-10" style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);">
                </div>
              </div>
              <div>
                <label class={labelClass}>Date de Naissance</label>
                <div class="relative">
                  <Cake size={16} class="absolute left-3 top-3.5 text-gray-500" />
                  <input type="date" bind:value={profileData.birthday} class="{inputClass} pl-10 dark:[color-scheme:dark]" style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class={labelClass}>Fonction</label>
                    <div class="relative">
                      <Tag size={16} class="absolute left-3 top-3.5 text-gray-500" />
                      <select bind:value={profileData.fonction} class="{inputClass} pl-10 appearance-none" style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);">
                          <option value={null} class="bg-gray-900 text-gray-400">-- Non spécifié --</option>
                          <option value="PACO" class="bg-gray-900">PACO</option>
                          <option value="RCCA" class="bg-gray-900">RCCA</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label class={labelClass}>Rôle</label>
                    <div class="relative">
                      <Shield size={16} class="absolute left-3 top-3.5 text-gray-500" />
                      <select bind:value={profileData.role} class="{inputClass} pl-10 appearance-none capitalize" style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);">
                          <option value="user" class="bg-gray-900">User</option>
                          <option value="moderator" class="bg-gray-900">Modérateur</option>
                          <option value="admin" class="bg-gray-900">Admin</option>
                      </select>
                    </div>
                  </div>
              </div>
            </div>

            <div class="pt-4 flex justify-end border-t border-white/5">
                <button 
                  on:click={handleUpdateProfile} 
                  disabled={isSaving}
                  class="btn-primary-glow px-6 py-2.5 text-white rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 border border-white/10"
                >
                  {#if isSaving} <Loader2 class="animate-spin w-4 h-4"/> {:else} <Save size={16}/> {/if}
                  Enregistrer
                </button>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-8" in:fly={{ x: 20, duration: 600, delay: 200 }}>
        
        <div class="bg-black/20 border border-white/5 rounded-3xl p-8 shadow-sm relative overflow-hidden">
          <div class="absolute top-0 right-0 p-32 opacity-10 rounded-full blur-3xl pointer-events-none"
               style="background-color: rgb(var(--color-primary));"></div>
          
          <div class="flex justify-between items-center mb-6">
              <h2 class="text-lg font-bold text-gray-200 flex items-center gap-2">
                <CheckCircle size={20} style="color: rgb(var(--color-primary));" /> Niveau de Confiance
              </h2>
              <button 
                on:click={openAddInfraction}
                class="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold rounded-lg text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                  <Plus size={14}/> Ajouter sanction
              </button>
          </div>
          
          <div class="mb-8">
            <div class="w-full bg-black/40 rounded-full h-4 overflow-hidden border border-white/5 shadow-inner">
              <div class="h-4 rounded-full transition-all duration-1000 ease-out {trustColor} relative" style="width: {trustScore}%"></div>
            </div>
            <p class="text-right text-xs font-bold mt-2 {trustColor === 'bg-gradient-to-r from-red-600 to-red-700' ? 'text-red-400' : 'text-gray-400'}">{trustLabel} ({trustScore}%)</p>
          </div>

          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2"><History size={12}/> Historique</h3>
          
          <div class="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {#if infractions.length === 0}
                  <div class="text-center py-6 text-gray-500 text-sm italic">Aucune sanction enregistrée.</div>
              {:else}
                  {#each infractions as inf}
                      <div class="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-start {inf.is_active ? '' : 'opacity-50 grayscale'}">
                          <div class="flex gap-3">
                              <div class="mt-1">
                                  {#if inf.card_type === 'red'}
                                      <AlertOctagon size={18} class="text-red-500" />
                                  {:else}
                                      <FileWarning size={18} class="text-yellow-500" />
                                  {/if}
                              </div>
                              <div>
                                  <p class="text-sm font-bold text-gray-200">{inf.reason}</p>
                                  <p class="text-xs text-gray-500">
                                      Par {inf.admin?.full_name || 'Admin'} • {new Date(inf.created_at).toLocaleDateString()}
                                      {#if !inf.is_active} <span class="text-green-500 ml-2">(Pardonné)</span> {/if}
                                  </p>
                              </div>
                          </div>
                          {#if inf.is_active}
                              <button on:click={() => pardonInfraction(inf.id)} class="text-xs text-gray-600 hover:text-green-400 underline p-1">Pardonner</button>
                          {/if}
                      </div>
                  {/each}
              {/if}
          </div>
        </div>

        <div class="bg-black/20 border border-purple-500/10 rounded-3xl p-8 shadow-sm relative">
            <h2 class="text-lg font-bold text-gray-200 mb-6 flex items-center gap-2">
                <Shield size={20} class="text-purple-400" /> Granularité des Permissions
            </h2>

            <div class="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {#each Object.entries(ACTIONS) as [key, action]}
                    {@const state = getPermissionState(action)}
                    
                    <button 
                        on:click={() => togglePermission(action)}
                        class="flex items-center justify-between p-3 rounded-xl border text-sm transition-all
                        {state === 'granted' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 
                         state === 'denied' ? 'bg-red-500/10 border-red-500/50 text-red-400' : 
                         state === 'inherited_yes' ? 'bg-white/5 border-white/5 text-gray-400 opacity-75' : 
                         'bg-black/20 border-transparent text-gray-600 opacity-50'}"
                    >
                        <span class="font-mono">{action}</span>
                        
                        <span class="text-xs font-bold px-2 py-1 rounded border
                            {state === 'granted' ? 'border-green-500/30 bg-green-500/20' : 
                             state === 'denied' ? 'border-red-500/30 bg-red-500/20' : 
                             'border-transparent'}">
                            
                            {#if state === 'granted'} FORCÉ: OUI
                            {:else if state === 'denied'} FORCÉ: NON
                            {:else if state === 'inherited_yes'} (Hérité: Oui)
                            {:else} (Hérité: Non)
                            {/if}
                        </span>
                    </button>
                {/each}
            </div>
            <p class="text-xs text-gray-500 mt-4 italic">
                Cliquez pour cycler : <br>
                Hérité &rarr; <span class="text-green-400">Forcé OUI</span> &rarr; <span class="text-red-400">Forcé NON</span> &rarr; Reset.
            </p>
        </div>

        <div class="bg-black/20 border border-red-500/10 rounded-3xl p-8 shadow-sm relative">
            <h2 class="text-lg font-bold text-gray-200 mb-6 flex items-center gap-2">
              <Lock size={20} class="text-red-400" /> Zone Admin
            </h2>

            <div class="space-y-6">
                <div>
                    <label class={labelClass}>Accès Compte</label>
                    <button 
                        on:click={() => toggleBan()}
                        class="w-full mt-2 py-3 rounded-xl font-bold transition-all shadow-sm flex justify-center gap-2 border {profileData.banned_until ? 'bg-green-600/20 text-green-400 border-green-500/30 hover:bg-green-600/30' : 'bg-red-600/20 text-red-400 border-red-500/30 hover:bg-red-600/30'}"
                    >
                        {#if profileData.banned_until}
                            <UserCheck size={20}/> Débannir l'utilisateur
                        {:else}
                            <UserX size={20}/> Bannir l'utilisateur
                        {/if}
                    </button>
                </div>

                <div class="pt-4 border-t border-white/5">
                    <label class={labelClass}>Sécurité</label>
                    <div class="flex gap-2 mt-2">
                        <button on:click={() => handleResetPassword()} disabled={resetLoading} class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                            {#if resetLoading}<Loader2 class="animate-spin w-4 h-4"/>{:else}<KeyRound size={16}/>{/if} Reset Password
                        </button>
                    </div>
                    {#if generatedPassword}
                        <div class="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex justify-between items-center" transition:slide>
                            <span class="font-mono text-yellow-400 font-bold tracking-wider">{generatedPassword}</span>
                            <button on:click={copyPassword} class="text-yellow-500 hover:text-white"><Copy size={16}/></button>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

      </div>
    </main>

 {:else}
    <div class="bg-black/20 border border-white/5 rounded-3xl p-6 shadow-sm" in:fly={{ y: 20, duration: 400 }}>
        <h2 class="text-lg font-bold text-gray-200 mb-6 flex items-center gap-2">
            <UserPlus size={20} style="color: rgb(var(--primary-rgb));"/> Nouvel Utilisateur
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label class={labelClass}>Email</label><input type="email" bind:value={newUser.email} class={inputClass} placeholder="user@baco.be" style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);"></div>
            <div><label class={labelClass}>Mot de passe</label><input type="text" bind:value={newUser.password} class={inputClass} placeholder="Secret..." style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);"></div>
            <div>
                <label class={labelClass}>Rôle</label>
                <select bind:value={newUser.role} class="{inputClass} appearance-none" style="--tw-ring-color: rgba(var(--primary-rgb), 0.3);">
                    <option value="user" class="bg-gray-900 text-white">Utilisateur</option>
                    <option value="moderator" class="bg-gray-900 text-white">Modérateur</option>
                    <option value="admin" class="bg-gray-900 text-white">Admin</option>
                </select>
            </div>
            <button on:click={handleCreateUser} disabled={isCreating} class="btn-primary-glow flex items-center justify-center gap-2 w-full px-4 py-3 text-white rounded-xl font-bold transition-all disabled:opacity-50 h-[46px]">
                {#if isCreating} <Loader2 class="animate-spin" size={18}/> {:else} <Plus size={18}/> Créer {/if}
            </button>
        </div>
    </div>

    <div class="bg-black/20 border border-white/5 rounded-3xl shadow-sm overflow-hidden" in:fly={{ y: 20, duration: 400, delay: 100 }}>
        <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-white/5">
          <thead class="bg-white/[0.02]">
            <tr>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white select-none group" on:click={() => toggleSort('full_name')}>
                  <div class="flex items-center gap-2">Utilisateur <ArrowUpDown size={12} class="opacity-0 group-hover:opacity-50 {sortCol === 'full_name' ? 'opacity-100 text-blue-400' : ''}"/></div>
              </th>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white select-none group" on:click={() => toggleSort('role')}>
                  <div class="flex items-center gap-2">Rôle <ArrowUpDown size={12} class="opacity-0 group-hover:opacity-50 {sortCol === 'role' ? 'opacity-100 text-blue-400' : ''}"/></div>
              </th>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Sanctions</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white select-none group" on:click={() => toggleSort('last_active')}>
                  <div class="flex items-center gap-2">Dernière Connexion <ArrowUpDown size={12} class="opacity-0 group-hover:opacity-50 {sortCol === 'last_active' ? 'opacity-100 text-blue-400' : ''}"/></div>
              </th>
              <th class="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-white/5">
            {#each sortedUsers as user (user.user_id)}
              {@const isBanned = user.banned_until && new Date(user.banned_until) > new Date()}
              {@const nextRoleData = getNextRole(user.role || 'user')}
              
              <tr class="group hover:bg-white/[0.02] transition-colors">
               <td class="px-6 py-4 whitespace-nowrap">
                  <a href="/admin/utilisateur/{user.user_id}" class="flex items-center gap-4 w-full text-left group-hover:opacity-80 transition-opacity">
                    <img class="h-10 w-10 rounded-full object-cover border border-white/10" src={user.avatar_url || '/default-avatar.png'} alt="">
                    <div>
                      <div class="text-sm font-bold text-gray-200">{user.full_name || user.email}</div>
                      <div class="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </a>
                </td>
            
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if user.role === 'admin'} <span class="role-badge role-admin">Admin</span>
                  {:else if user.role === 'moderator'} <span class="role-badge role-modo">Modérateur</span>
                  {:else} <span class="role-badge role-user">Utilisateur</span> {/if}
                </td>
              
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if isBanned}
                    <span class="px-2.5 py-1 text-xs font-bold rounded-lg border bg-red-500/10 text-red-400 border-red-500/20 animate-pulse">Banni</span>
                  {:else}
                    <span class="px-2.5 py-1 text-xs font-bold rounded-lg border bg-green-500/10 text-green-400 border-green-500/20">Actif</span>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex gap-2">
                      {#if user.active_yellow_cards > 0} <span class="text-yellow-500 text-xs font-bold bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">⚠ {user.active_yellow_cards}</span> {/if}
                      {#if user.active_red_cards > 0} <span class="text-red-500 text-xs font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">🚷 {user.active_red_cards}</span> {/if}
                  </div>
                </td>
                
                <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                  {#if user.last_active}
                      {formatDate(user.last_active)}
                      {#if new Date(user.last_active) > new Date(Date.now() - 300000)} 
                          <span class="inline-block w-2 h-2 rounded-full bg-green-500 ml-2 animate-pulse" title="En ligne récemment"></span>
                      {/if}
                  {:else}
                      Jamais
                  {/if}
                </td>

                <td class="px-6 py-4 whitespace-nowrap text-center">
                  {#if user.user_id !== currentAdminId}
                    <div class="flex justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button on:click={() => handleResetPassword(user)} class="action-icon-btn hover:text-white" title="Reset Password"><KeyRound size={16}/></button>
                      <button on:click={() => openInfractionModalList(user)} class="action-icon-btn text-yellow-600 hover:text-yellow-400" title="Gérer Sanctions"><FileWarning size={16}/></button>
                      <button on:click={() => handleChangeRole(user, nextRoleData.role)} class="action-icon-btn {nextRoleData.color} hover:bg-white/5" title={nextRoleData.label}><svelte:component this={nextRoleData.icon} size={16} /></button>
                      {#if !isBanned}
                          <button on:click={() => toggleBan(user)} class="action-icon-btn text-red-600 hover:text-red-400" title="Bannir"><UserX size={16}/></button>
                      {:else}
                          <button on:click={() => toggleBan(user)} class="action-icon-btn text-green-600 hover:text-green-400" title="Débannir"><UserCheck size={16}/></button>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-xs text-gray-500 italic">Vous</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
    </div>
 {/if}

  {#if showInfractionModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" transition:fade>
      <div class="bg-[#0f1115] w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10" transition:fly={{ y: 20 }}>
          <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-bold text-white flex items-center gap-2"><AlertTriangle class="text-yellow-500"/> Ajouter Sanction</h3>
              <button on:click={() => showInfractionModal = false} class="text-gray-500 hover:text-white"><X size={20}/></button>
          </div>
          
          <div class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                  <button 
                      class="p-3 rounded-xl border-2 font-bold transition-all {infractionData.type === 'yellow' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-white/10 bg-black/40 text-gray-500'}"
                      on:click={() => infractionData.type = 'yellow'}
                  >
                      Avertissement
                  </button>
                  <button 
                      class="p-3 rounded-xl border-2 font-bold transition-all {infractionData.type === 'red' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 bg-black/40 text-gray-500'}"
                      on:click={() => infractionData.type = 'red'}
                  >
                      Sanction Grave
                  </button>
              </div>
              
              <div>
                  <label class={labelClass}>Motif</label>
                  <textarea bind:value={infractionData.reason} class="{inputClass} h-24 resize-none" placeholder="Ex: Comportement inapproprié..."></textarea>
              </div>
              
              <button on:click={submitInfraction} disabled={infractionLoading} class="w-full py-3 rounded-xl font-bold text-black bg-white hover:bg-gray-200 transition-colors flex justify-center items-center gap-2">
                  {#if infractionLoading} <Loader2 class="animate-spin w-5 h-5"/> {:else} Confirmer {/if}
              </button>
          </div>
      </div>
    </div>
  {/if}

</div>

<style>
  .btn-primary-glow {
    background-color: rgba(var(--primary-rgb), 0.8);
    box-shadow: 0 0 15px rgba(var(--primary-rgb), 0.3);
    border: 1px solid rgba(var(--primary-rgb), 0.3);
  }
  .btn-primary-glow:hover:not(:disabled) {
    background-color: rgb(var(--primary-rgb));
    box-shadow: 0 0 25px rgba(var(--primary-rgb), 0.5);
    transform: translateY(-1px);
  }
  .action-icon-btn { padding: 0.5rem; border-radius: 0.5rem; transition: all 0.2s; }
  .action-icon-btn:hover { background-color: rgba(255, 255, 255, 0.05); transform: scale(1.1); }
  .role-badge { padding: 0.25rem 0.625rem; display: inline-flex; font-size: 0.75rem; font-weight: 800; border-radius: 0.5rem; border-width: 1px; }
  .role-admin { background-color: rgba(var(--primary-rgb), 0.1); color: rgb(var(--primary-rgb)); border-color: rgba(var(--primary-rgb), 0.3); }
  .role-modo { background-color: rgba(168, 85, 247, 0.1); color: rgb(168, 85, 247); border-color: rgba(168, 85, 247, 0.3); }
  .role-user { background-color: rgba(255, 255, 255, 0.05); color: #9ca3af; border-color: rgba(255, 255, 255, 0.1); }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
  .themed-spinner { color: rgb(var(--primary-rgb)); }
  .text-themed { color: rgb(var(--primary-rgb)); }
</style>