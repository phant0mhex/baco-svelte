<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    FileText, Folder, Search, Upload, Trash2, 
    Eye, Download, Loader2, FolderOpen, File 
  } from 'lucide-svelte';

  // --- ÉTAT ---
  let documents = [];
  let categories = [];
  let isLoading = true;
  let isUploading = false;
  
  let searchQuery = "";
  let selectedCategory = "all";
  let uploadStatus = ""; // Pour afficher les messages d'état

  onMount(async () => {
    await loadCategories();
    await loadDocuments();
  });

  // --- CHARGEMENT DONNÉES ---

  async function loadCategories() {
    const { data, error } = await supabase
      .from('document_metadata')
      .select('categorie');
      
    if (data) {
      // Extraction des catégories uniques et tri
      categories = [...new Set(data.map(p => p.categorie))].sort();
    }
  }

  async function loadDocuments() {
    isLoading = true;
    let query = supabase
      .from('document_metadata')
      .select('file_name, categorie')
      .order('file_name', { ascending: true });

    if (selectedCategory !== 'all') {
      query = query.eq('categorie', selectedCategory);
    }
    
    if (searchQuery.trim()) {
      query = query.ilike('file_name', `%${searchQuery.trim()}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Erreur:", error);
      alert("Erreur lors du chargement des documents.");
    } else {
      documents = data || [];
    }
    isLoading = false;
  }

  // --- ACTIONS ---

  async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Fidèle à votre script original : on demande la catégorie via un prompt
    const categorie = prompt(`Catégorie pour "${file.name}" :`, "Procédures");
    if (!categorie) {
      alert("Upload annulé : catégorie requise.");
      event.target.value = null; 
      return;
    }

    isUploading = true;
    uploadStatus = `Envoi de "${file.name}"...`;
    
    try {
      // 1. Récupérer l'user
      const { data: { user } } = await supabase.auth.getUser();
      
      // 2. Upload Storage
      const { error: uploadError } = await supabase
        .storage
        .from('documents')
        .upload(file.name, file, { upsert: true }); 
        
      if (uploadError) throw uploadError;

      // 3. Metadata DB
      const { error: metadataError } = await supabase
        .from('document_metadata')
        .upsert({ 
          file_name: file.name, 
          categorie: categorie,
          uploaded_by: user?.id 
        }, { 
          onConflict: 'file_name' 
        });

      if (metadataError) throw metadataError;

      uploadStatus = "";
      alert(`Fichier importé avec succès !`);
      
      // Rafraîchir
      await Promise.all([loadCategories(), loadDocuments()]);

    } catch (error) {
      console.error(error);
      alert(`Erreur d'upload : ${error.message}`);
      uploadStatus = "";
    } finally {
      isUploading = false;
      event.target.value = null; // Reset input
    }
  }

  async function deleteDocument(fileName) {
    if (!confirm(`Supprimer définitivement "${fileName}" ?`)) return;
    
    try {
      // 1. Suppr Metadata
      const { error: metadataError } = await supabase
        .from('document_metadata')
        .delete()
        .eq('file_name', fileName);
        
      if (metadataError) throw metadataError;
        
      // 2. Suppr Storage
      const { error: storageError } = await supabase
        .storage
        .from('documents')
        .remove([fileName]);

      if (storageError) throw storageError;

      await loadCategories(); // Au cas où une catégorie devient vide
      await loadDocuments();

    } catch (error) {
      alert(`Erreur suppression : ${error.message}`);
    }
  }

  // --- HELPERS UI ---

  function getPublicUrl(fileName) {
    const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
    return data.publicUrl;
  }

  function isPreviewable(fileName) {
    return fileName.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i);
  }

  function openFile(fileName) {
    const url = getPublicUrl(fileName);
    window.open(url, '_blank');
  }

</script>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-10">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
          <FolderOpen size={24} />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Documents</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Bibliothèque opérationnelle</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        {#if isUploading}
          <div class="hidden sm:flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 animate-pulse mr-2">
            <Loader2 size={16} class="animate-spin"/> {uploadStatus}
          </div>
        {/if}
        
        <label class="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow active:scale-95">
          <Upload size={20} /> 
          <span class="hidden sm:inline">Importer</span>
          <input 
            type="file" 
            class="hidden" 
            on:change={handleUpload}
            disabled={isUploading} 
          />
        </label>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
    
    <aside class="w-full lg:w-64 flex-shrink-0 space-y-6">
      
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search size={16} />
        </div>
        <input 
          type="text" 
          placeholder="Nom du fichier..." 
          bind:value={searchQuery} 
          on:input={loadDocuments} 
          class="block w-full pl-9 pr-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <nav class="space-y-1">
        <h3 class="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Dossiers</h3>
        <button 
          on:click={() => { selectedCategory = 'all'; loadDocuments(); }}
          class="w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all {selectedCategory === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'}"
        >
          <Folder size={16} class="mr-2 {selectedCategory === 'all' ? 'text-white' : 'text-gray-400'}" /> 
          Tout voir
        </button>
        
        {#each categories as cat}
          <button 
            on:click={() => { selectedCategory = cat; loadDocuments(); }}
            class="w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all {selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'}"
          >
            <Folder size={16} class="mr-2 {selectedCategory === cat ? 'text-white' : 'text-gray-400'}" />
            {cat}
          </button>
        {/each}
      </nav>
    </aside>

    <div class="flex-grow">
      {#if isLoading}
        <div class="flex justify-center py-20">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      {:else if documents.length === 0}
        <div class="text-center py-24 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <FileText size={48} class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Dossier vide</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Aucun document trouvé ici.</p>
        </div>
      {:else}
        <div class="grid gap-3">
          {#each documents as doc}
            <div class="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all duration-200">
              
              <div class="flex items-center gap-4 overflow-hidden">
                <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 flex-shrink-0">
                  <FileText size={20} />
                </div>
                <div class="min-w-0">
                  <h4 class="text-sm font-bold text-gray-900 dark:text-white truncate" title={doc.file_name}>
                    {doc.file_name}
                  </h4>
                  <span class="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1 mt-0.5">
                    <Folder size={10} /> {doc.categorie}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button 
                  on:click={() => openFile(doc.file_name)}
                  class="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl transition-colors"
                  title={isPreviewable(doc.file_name) ? "Prévisualiser" : "Télécharger"}
                >
                  {#if isPreviewable(doc.file_name)}
                    <Eye size={18} />
                  {:else}
                    <Download size={18} />
                  {/if}
                </button>

                <button 
                  on:click={() => deleteDocument(doc.file_name)}
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </div>

            </div>
          {/each}
        </div>
      {/if}
    </div>

  </main>
</div>