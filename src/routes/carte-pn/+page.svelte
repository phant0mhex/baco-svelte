<script>
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { Search, Map as MapIcon, Loader2 } from 'lucide-svelte';
  
  // --- ÉTAT ---
  let mapElement;
  let map;
  let markersLayer;
  let zoneBoundariesLayer;
  
  let allPnData = [];
  let availableLines = [];
  let selectedLines = []; // ['L.75', 'L.90'...]
  let showAllLines = true;
  let searchQuery = "";
  
  let isLoading = true;

  // Configuration des zones (Statique)
  const zonePolygons = {
    'FTY': {
      coordinates: [[50.7610, 3.2240], [50.7166, 3.2403], [50.4569, 3.7785], [50.7211, 4.1717], [50.71352307887864, 4.178040380091445]],
      color: '#3b82f6', name: "Zone FTY"
    },
    'FMS': {
      coordinates: [[50.4102, 3.6856], [50.4569, 3.7785], [50.6145, 3.7998], [50.6055, 4.1379], [50.7069, 4.2124], [50.5064, 4.2342], [50.4603, 4.2441], [50.404955, 4.174978], [50.4512, 3.9391], [50.4720, 3.9574], [50.3291, 3.9083]],
      color: '#eab308', name: "Zone FMS"
    },
    'FCR': {
      coordinates: [[50.7302, 4.3785], [50.5048, 4.3876], [50.4863, 4.5478], [50.4457, 4.6463], [50.0566, 4.4920], [50.3033, 4.1110], [50.4603, 4.2441], [50.5035, 4.2399]],
      color: '#ef4444', name: "Zone FCR"
    }
  };

  onMount(async () => {
    // 1. Charger les données (Lignes + PN)
    await Promise.all([loadLines(), loadAllPnData()]);
    
    // 2. Initialiser la carte (Leaflet a besoin du DOM et de window)
    if (typeof window !== 'undefined') {
      // Import dynamique de Leaflet (Core)
      const leaflet = await import('leaflet');
      
      // FIX: Rendre L global pour que le plugin CDN puisse le trouver
      window.L = leaflet.default || leaflet;

      // Import manuel du plugin Fullscreen via CDN (évite l'erreur npm)
      await loadScript('https://unpkg.com/leaflet.fullscreen@2.4.0/Control.Fullscreen.js');
      
      initMap();
    }
  });

  onDestroy(() => {
    if (map) map.remove();
  });

  // Fonction utilitaire pour charger un script CDN
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // --- CHARGEMENT DONNÉES ---

  async function loadLines() {
    const { data } = await supabase.from('pn_data').select('ligne_nom');
    if (data) {
      const lines = [...new Set(data.map(i => i.ligne_nom).filter(Boolean))].sort();
      availableLines = lines;
      selectedLines = [...lines]; // Tout cocher par défaut
    }
  }

  async function loadAllPnData() {
    const { data, error } = await supabase
      .from('pn_data')
      .select('ligne_nom, pn, bk, adresse, geo')
      .not('geo', 'is', null);
      
    if (!error) allPnData = data;
    isLoading = false;
  }

  // --- CARTE LEAFLET ---

  function initMap() {
    if (!mapElement) return;

    // Création de la carte
    map = L.map(mapElement, {
      center: [50.63, 4.47],
      zoom: 9,
      fullscreenControl: true // Le plugin est maintenant chargé
    });

    // Couches de tuiles
    const layers = {
      'Satellite': L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22, subdomains:['mt0','mt1','mt2','mt3'], attribution: 'Google'
      }),
      'Plan': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22, attribution: 'OpenStreetMap'
      }),
      'Hybride': L.tileLayer('http://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        maxZoom: 22, subdomains:['mt0','mt1','mt2','mt3'], attribution: 'Google'
      })
    };
    
    layers['Satellite'].addTo(map); // Défaut

    // Groupes de couches
    markersLayer = L.layerGroup().addTo(map);
    zoneBoundariesLayer = L.layerGroup().addTo(map);

    // Contrôle des couches
    L.control.layers(layers, {
      "Zones SPI": zoneBoundariesLayer,
      "Passages à Niveau (PN)": markersLayer
    }).addTo(map);

    // Dessiner les zones SPI
    drawZones();

    // Dessiner les marqueurs initiaux
    updateMapMarkers();
  }

  function drawZones() {
    Object.values(zonePolygons).forEach(zone => {
      L.polygon(zone.coordinates, { 
        color: zone.color, weight: 3, opacity: 0.8, fillOpacity: 0.1 
      })
      .bindPopup(`<h4 class="font-bold text-blue-600 dark:text-blue-400">${zone.name}</h4>`)
      .addTo(zoneBoundariesLayer);
    });
  }

  // --- FILTRAGE ET MISE À JOUR ---

  // Réactif : Recalculer les PN filtrés quand les filtres changent
  $: filteredPn = allPnData.filter(pn => {
    const lineMatch = selectedLines.includes(pn.ligne_nom);
    const searchMatch = !searchQuery.trim() || 
      (pn.pn && pn.pn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (pn.bk && pn.bk.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return lineMatch && searchMatch;
  });

  // Réactif : Mettre à jour la carte quand les données filtrées changent
  $: if (map && markersLayer && filteredPn) {
    updateMapMarkers();
  }

  function updateMapMarkers() {
    if (!markersLayer) return;
    markersLayer.clearLayers();
    
    const newMarkers = [];

    filteredPn.forEach(pn => {
      if (!pn.geo) return;
      const [lat, lon] = pn.geo.split(',').map(parseFloat);
      
      if (!isNaN(lat) && !isNaN(lon)) {
        const popupContent = `
          <div class="font-sans text-sm dark:text-gray-200">
            <h4 class="font-bold text-base text-blue-700 dark:text-blue-400 mb-1">
              PN ${pn.pn || '?'} - Ligne ${pn.ligne_nom || '?'}
            </h4>
            <p class="mb-0.5"><strong class="text-gray-600 dark:text-gray-400">BK:</strong> ${pn.bk || 'N/A'}</p>
            <p><strong class="text-gray-600 dark:text-gray-400">Adresse:</strong> ${pn.adresse || 'N/A'}</p>
          </div>
        `;
        
        const marker = L.marker([lat, lon]).bindPopup(popupContent, {
          // Astuce : Classes Tailwind dans les options de Popup Leaflet pour le Dark Mode
          className: 'custom-popup' 
        });
        
        newMarkers.push(marker);
        markersLayer.addLayer(marker);
      }
    });

    // Auto-zoom si on a filtré (pas au chargement initial complet)
    if (newMarkers.length > 0 && newMarkers.length < allPnData.length) {
      const group = L.featureGroup(newMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // Gestion "Afficher tout"
  function toggleAllLines(e) {
    showAllLines = e.target.checked;
    if (showAllLines) {
      selectedLines = [...availableLines];
    } else {
      selectedLines = [];
    }
  }

  // Gestion clic individuel (décoche "Tout" si une ligne est décochée)
  function handleLineChange(line) {
    if (selectedLines.includes(line)) {
      selectedLines = selectedLines.filter(l => l !== line);
      showAllLines = false;
    } else {
      selectedLines = [...selectedLines, line];
      if (selectedLines.length === availableLines.length) showAllLines = true;
    }
  }

</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.fullscreen@2.4.0/Control.Fullscreen.css" />
</svelte:head>

<div class="min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-10">
  
  <header class="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 rounded-b-3xl transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center gap-3">
      <div class="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
        <MapIcon size={24} />
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Carte Interactive</h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Passages à Niveau et Zones</p>
      </div>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
    
    <aside class="w-full lg:w-1/4 space-y-6">
      <div class="sticky top-24 space-y-6">
        
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Search size={16} /></div>
          <input 
            type="text" 
            placeholder="PN 121 ou 124.500..." 
            bind:value={searchQuery}
            class="block w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 max-h-[70vh] overflow-y-auto">
          <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Lignes</h3>
          
          {#if isLoading}
            <div class="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} class="animate-spin"/> Chargement...</div>
          {:else}
            <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input type="checkbox" checked={showAllLines} on:change={toggleAllLines} class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600">
              <span class="font-bold text-sm text-gray-800 dark:text-gray-200">Toutes les lignes</span>
            </label>
            
            <div class="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>

            {#each availableLines as line}
              <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedLines.includes(line)} 
                  on:change={() => handleLineChange(line)}
                  class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                >
                <span class="text-sm text-gray-700 dark:text-gray-300">{line}</span>
              </label>
            {/each}
          {/if}
        </div>

      </div>
    </aside>

    <main class="w-full lg:w-3/4 space-y-8">
      
      <div 
        bind:this={mapElement} 
        id="map" 
        class="w-full h-[600px] rounded-3xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden z-0 bg-gray-100 dark:bg-gray-900"
      ></div>

      <div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          Résultats de la liste <span class="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">{filteredPn.length}</span>
        </h2>
        
        <div class="grid gap-3 max-h-96 overflow-y-auto pr-1">
          {#each filteredPn.slice(0, 50) as pn} <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
              <div>
                <h3 class="font-bold text-gray-900 dark:text-white text-sm">PN {pn.pn} <span class="text-gray-400 font-normal">- {pn.ligne_nom}</span></h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{pn.adresse}</p>
              </div>
              <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                {pn.bk}
              </span>
            </div>
          {/each}
          {#if filteredPn.length > 50}
            <p class="text-center text-xs text-gray-500 italic mt-2">... et {filteredPn.length - 50} autres résultats (affinez la recherche)</p>
          {/if}
        </div>
      </div>

    </main>

  </div>
</div>

<style>
  /* Personnalisation Dark Mode pour Leaflet - Version CSS Standard */
  
  :global(.custom-popup .leaflet-popup-content-wrapper),
  :global(.custom-popup .leaflet-popup-tip) {
    background-color: #ffffff;
    color: #374151;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  /* Dark Mode overrides */
  :global(.dark .custom-popup .leaflet-popup-content-wrapper),
  :global(.dark .custom-popup .leaflet-popup-tip) {
    background-color: #1f2937;
    color: #e5e7eb;
    border-color: #374151;
  }

  /* Bouton fermer */
  :global(.custom-popup .leaflet-popup-close-button) {
    color: #9ca3af;
  }
  :global(.custom-popup .leaflet-popup-close-button:hover) {
    color: #4b5563;
  }
  :global(.dark .custom-popup .leaflet-popup-close-button) {
    color: #6b7280;
  }
  :global(.dark .custom-popup .leaflet-popup-close-button:hover) {
    color: #d1d5db;
  }
</style>