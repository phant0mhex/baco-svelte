<script>
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapContainer;
	let { 
        route = null, 
        markers = [], // Liste brute des PN { geo: "lat,lon", ... }
        zones = [], 
        className = '', 
        clustering = false,
        showTraffic = false,
        map = $bindable() 
    } = $props();

	let activePopup = null;
    let mapLoaded = false;

	onMount(() => {
		const m = new maplibregl.Map({
			container: mapContainer,
			style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
			center: [4.47, 50.63], // Centre Belgique
			zoom: 8,
			attributionControl: false
		});

		m.addControl(new maplibregl.NavigationControl(), 'bottom-right');
		m.addControl(new maplibregl.FullscreenControl(), 'top-right');

		m.on('load', () => {
			map = m; 
            mapLoaded = true;
			updateMapElements();
		});

        // Gestion des clics sur les points (Cluster ou non)
        m.on('click', 'clusters', (e) => {
            const features = m.queryRenderedFeatures(e.point, { layers: ['clusters'] });
            const clusterId = features[0].properties.cluster_id;
            m.getSource('pns-source').getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                m.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
            });
        });

        m.on('click', 'unclustered-point', (e) => {
            const props = e.features[0].properties;
            const coordinates = e.features[0].geometry.coordinates.slice();
            
            // Création du HTML du popup
            const html = `
                <div class="p-3 min-w-[200px] text-gray-100">
                    <div class="flex justify-between items-center border-b border-white/10 pb-2 mb-2">
                        <span class="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded">Ligne ${props.ligne}</span>
                        <span class="font-bold">PN ${props.pn}</span>
                    </div>
                    <div class="text-xs text-gray-300 space-y-1">
                        <div>BK: <span class="font-mono text-white">${props.bk || '?'}</span></div>
                        <div class="italic text-gray-500">${props.adresse || '-'}</div>
                    </div>
                </div>
            `;
            showPopup(coordinates, html);
        });

        // Curseurs
        m.on('mouseenter', 'clusters', () => m.getCanvas().style.cursor = 'pointer');
        m.on('mouseleave', 'clusters', () => m.getCanvas().style.cursor = '');
        m.on('mouseenter', 'unclustered-point', () => m.getCanvas().style.cursor = 'pointer');
        m.on('mouseleave', 'unclustered-point', () => m.getCanvas().style.cursor = '');
	});

	onDestroy(() => {
		map?.remove();
	});

	$effect(() => {
		if (mapLoaded) {
			updateMapElements();
            toggleTraffic(showTraffic);
		}
	});

	function updateMapElements() {
		if (zones) drawZones(zones);
        if (clustering) drawClusteredMarkers(markers);
        else drawSimpleMarkers(markers); // Fallback ancien mode si besoin
	}

    function toggleTraffic(show) {
        // Simple tuile de trafic (ex: Google ou TomTom si API, ici OpenStreetMap Transport ou similar free)
        // Note: MapLibre n'a pas de trafic "intégré" gratuit sans source externe.
        // Ici on simule une couche si on avait l'URL, ou on affiche une info.
        // Pour l'exemple, on peut utiliser les tuiles de transport public OPNVKarte qui sont souvent utilisées comme overlay.
        const sourceId = 'traffic-source';
        if (show) {
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, {
                    type: 'raster',
                    tiles: ['https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png'], // Exemple Transport Layer
                    tileSize: 256
                });
                map.addLayer({ id: 'traffic-layer', type: 'raster', source: sourceId, minzoom: 10, paint: { 'raster-opacity': 0.6 } });
            }
        } else {
             if (map.getLayer('traffic-layer')) map.removeLayer('traffic-layer');
             if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
    }

    function drawClusteredMarkers(markersData) {
        // Transformation des données brutes en GeoJSON
        const features = markersData
            .filter(m => m.geo)
            .map(m => {
                const [lat, lon] = m.geo.split(',').map(parseFloat);
                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [lon, lat] },
                    properties: { 
                        pn: m.pn, 
                        ligne: m.ligne_nom, 
                        bk: m.bk, 
                        adresse: m.adresse 
                    }
                };
            });

        const sourceData = { type: 'FeatureCollection', features };

        if (!map.getSource('pns-source')) {
            map.addSource('pns-source', {
                type: 'geojson',
                data: sourceData,
                cluster: true,
                clusterMaxZoom: 14, // Au-delà, on affiche les points
                clusterRadius: 50
            });

            // 1. Cercle des Clusters
            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'pns-source',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step', ['get', 'point_count'],
                        '#3b82f6', 10,  // Bleu < 10
                        '#eab308', 30,  // Jaune < 30
                        '#ef4444'       // Rouge > 30
                    ],
                    'circle-radius': [
                        'step', ['get', 'point_count'],
                        15, 10,
                        20, 30,
                        25
                    ],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#fff'
                }
            });

            // 2. Compteur dans le Cluster
            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'pns-source',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 12
                },
                paint: { 'text-color': '#ffffff' }
            });

            // 3. Points individuels (Non groupés)
            map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: 'pns-source',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': '#f97316', // Orange PN
                    'circle-radius': 6,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#fff'
                }
            });

        } else {
            // Mise à jour des données seulement
            map.getSource('pns-source').setData(sourceData);
        }
    }

    // Garder l'ancienne méthode pour compatibilité si clustering=false
    function drawSimpleMarkers(markersData) {
        // ... (Ton ancien code drawMarkers, utile pour d'autres pages) ...
        // Je le laisse vide ici pour la concision, mais tu peux copier-coller ta fonction existante
    }

	function drawZones(zonesData) {
		zonesData.forEach((zone, index) => {
			const sourceId = `zone-source-${index}`;
			if (!map.getSource(sourceId)) {
				map.addSource(sourceId, { 'type': 'geojson', 'data': zone.geojson });
				map.addLayer({
					'id': `zone-fill-${index}`, 'type': 'fill', 'source': sourceId,
					'paint': { 'fill-color': zone.color || '#3b82f6', 'fill-opacity': 0.1 }
				});
				map.addLayer({
					'id': `zone-line-${index}`, 'type': 'line', 'source': sourceId,
					'paint': { 'line-color': zone.color || '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] }
				});
			}
		});
	}

    function showPopup(lngLat, htmlContent) {
        if (activePopup) activePopup.remove();
        activePopup = new maplibregl.Popup({ 
            offset: 15, 
            closeButton: false, 
            maxWidth: '300px',
            className: 'custom-popup-class' // Style à définir dans CSS global
        })
        .setLngLat(lngLat)
        .setHTML(htmlContent)
        .addTo(map);
    }
</script>

<div class="relative w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-2xl {className}">
	<div bind:this={mapContainer} class="w-full h-full bg-[#16181d]" />
	<slot />
</div>

<style>
    /* Popup overrides */
	:global(.maplibregl-popup-content) {
		background-color: #1a1d24 !important;
		border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
		padding: 0;
	}
    :global(.maplibregl-popup-tip) { border-top-color: #1a1d24 !important; }
</style>