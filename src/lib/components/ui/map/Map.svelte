<script>
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapContainer;
	let map = $state(null);
	let markerInstances = [];

	// Props mises à jour avec 'zones'
	let { route = null, markers = [], zones = [], className = '' } = $props();

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
			center: [4.47, 50.63], // Centré sur la Belgique
			zoom: 8,
			attributionControl: false
		});

		// Contrôles
		map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
		map.addControl(new maplibregl.FullscreenControl(), 'top-right');

		map.on('load', () => {
			updateMapElements();
		});
	});

	onDestroy(() => {
		map?.remove();
	});

	// Réactivité : Mise à jour quand les props changent
	$effect(() => {
		if (map && map.loaded()) {
			updateMapElements();
		}
	});

	function updateMapElements() {
		if (route) drawRoute(route);
		if (markers) drawMarkers(markers);
		if (zones) drawZones(zones);
	}

	function drawRoute(routeData) {
		if (!map.getSource('route')) {
			map.addSource('route', { 'type': 'geojson', 'data': routeData });
			map.addLayer({
				'id': 'route',
				'type': 'line',
				'source': 'route',
				'layout': { 'line-join': 'round', 'line-cap': 'round' },
				'paint': { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 }
			});
		} else {
			map.getSource('route').setData(routeData);
		}

		// Auto-zoom sur la route
		const coordinates = routeData.geometry.coordinates;
		if (coordinates && coordinates.length > 0) {
			const bounds = coordinates.reduce((bounds, coord) => {
				return bounds.extend(coord);
			}, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
			map.fitBounds(bounds, { padding: 50 });
		}
	}

	function drawMarkers(markersData) {
		// Nettoyage
		markerInstances.forEach(m => m.remove());
		markerInstances = [];

		markersData.forEach(m => {
			const el = document.createElement('div');
			
			// Styles de base
			let baseClass = 'w-3 h-3 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform';
			let colorClass = 'bg-orange-500'; // Défaut (utile pour les PN)

			// Styles spécifiques selon le type
			if (m.type === 'start') {
				baseClass = 'w-4 h-4 rounded-full border-2 border-white shadow-lg z-10';
				colorClass = 'bg-green-500';
			} else if (m.type === 'end') {
				baseClass = 'w-4 h-4 rounded-full border-2 border-white shadow-lg z-10';
				colorClass = 'bg-red-500';
			} else if (m.type === 'pn') {
				colorClass = 'bg-orange-500';
			}

			el.className = `${baseClass} ${colorClass}`;

			// Support du HTML dans les popups (ex: popupContent) ou texte simple (label)
			const popup = new maplibregl.Popup({ offset: 15, closeButton: false, maxWidth: '300px' })
				.setHTML(m.popupContent || m.label || '');

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat(m.lngLat)
				.setPopup(popup)
				.addTo(map);
			
			// Interaction
			el.addEventListener('mouseenter', () => marker.togglePopup());
			// Pour éviter que le popup se ferme si on veut cliquer sur un lien dedans, on peut gérer le mouseleave différemment
			// ou le laisser se fermer. Ici comportement simple :
			// el.addEventListener('mouseleave', () => marker.togglePopup()); 

			markerInstances.push(marker);
		});
	}

	function drawZones(zonesData) {
		zonesData.forEach((zone, index) => {
			const sourceId = `zone-source-${index}`;
			const fillId = `zone-fill-${index}`;
			const lineId = `zone-line-${index}`;

			if (!map.getSource(sourceId)) {
				map.addSource(sourceId, {
					'type': 'geojson',
					'data': zone.geojson
				});

				// Remplissage coloré
				map.addLayer({
					'id': fillId,
					'type': 'fill',
					'source': sourceId,
					'layout': {},
					'paint': {
						'fill-color': zone.color || '#3b82f6',
						'fill-opacity': 0.15
					}
				});

				// Contour
				map.addLayer({
					'id': lineId,
					'type': 'line',
					'source': sourceId,
					'layout': {},
					'paint': {
						'line-color': zone.color || '#3b82f6',
						'line-width': 2,
						'line-opacity': 0.8
					}
				});

				// Popup simple au survol de la zone
				map.on('mouseenter', fillId, (e) => {
					map.getCanvas().style.cursor = 'pointer';
					new maplibregl.Popup({ closeButton: false })
						.setLngLat(e.lngLat)
						.setHTML(`<div class="text-black font-bold px-2">${zone.name}</div>`)
						.addTo(map);
				});

				map.on('mouseleave', fillId, () => {
					map.getCanvas().style.cursor = '';
					// map.getCanvas().title = ''; // clear native tooltip if any
				});
			}
		});
	}
</script>

<div class="relative w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-2xl {className}">
	<div bind:this={mapContainer} class="w-full h-full bg-[#16181d]" />
	<slot />
</div>

<style>
	/* Styling MapLibre adapté au thème sombre */
	:global(.maplibregl-ctrl-group) {
		background-color: #0f1115 !important;
		border: 1px solid rgba(255,255,255,0.1) !important;
	}
	:global(.maplibregl-ctrl-icon) {
		filter: invert(1);
	}
	
	/* Style par défaut des popups MapLibre */
	:global(.maplibregl-popup-content) {
		background-color: #1a1d24;
		color: white;
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 12px;
		padding: 0;
		overflow: hidden;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}
	:global(.maplibregl-popup-tip) {
		border-top-color: #1a1d24;
	}
</style>