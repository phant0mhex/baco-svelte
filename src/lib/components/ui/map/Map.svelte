<script>
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapContainer;
	// On change ici : map est une prop "bindable", ce qui permet au parent de la contrôler
	let { route = null, markers = [], zones = [], className = '', map = $bindable() } = $props();
	
	let markerInstances = [];

	onMount(() => {
		// On initialise une variable locale temporaire pour l'instance
		const m = new maplibregl.Map({
			container: mapContainer,
			style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
			center: [4.47, 50.63],
			zoom: 8,
			attributionControl: false
		});

		m.addControl(new maplibregl.NavigationControl(), 'bottom-right');
		m.addControl(new maplibregl.FullscreenControl(), 'top-right');

		m.on('load', () => {
			// Une fois chargée, on assigne à la prop liée
			map = m;
			updateMapElements();
		});
	});

	onDestroy(() => {
		map?.remove();
	});

	// Réactivité : Met à jour les éléments quand les props changent
	$effect(() => {
		// On vérifie que la map existe et est chargée
		if (map && map.loaded()) {
			updateMapElements();
		}
	});

	function updateMapElements() {
		// L'ordre est important : Zones en fond, Route par dessus, Markers au premier plan
		if (zones) drawZones(zones);
		if (route) drawRoute(route);
		if (markers) drawMarkers(markers);
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
		
		// Auto-zoom seulement si c'est une nouvelle route, pas au rechargement général
		// (Vous pouvez décommenter si vous voulez zoomer sur la route à chaque changement)
		/*
		const coordinates = routeData.geometry.coordinates;
		if (coordinates && coordinates.length > 0) {
			const bounds = coordinates.reduce((bounds, coord) => bounds.extend(coord), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
			map.fitBounds(bounds, { padding: 50 });
		}
		*/
	}

	function drawMarkers(markersData) {
		// 1. Nettoyage des anciens marqueurs
		markerInstances.forEach(m => m.remove());
		markerInstances = [];

		// 2. Création des nouveaux
		markersData.forEach(m => {
			const el = document.createElement('div');
			
			let baseClass = 'w-3 h-3 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform';
			let colorClass = 'bg-orange-500'; 

			if (m.type === 'start') { baseClass = 'w-4 h-4 z-20'; colorClass = 'bg-green-500'; }
			else if (m.type === 'end') { baseClass = 'w-4 h-4 z-20'; colorClass = 'bg-red-500'; }
			else if (m.type === 'pn') { colorClass = 'bg-orange-500'; }

			el.className = `${baseClass} ${colorClass}`;

			const popup = new maplibregl.Popup({ offset: 15, closeButton: false, maxWidth: '300px' })
				.setHTML(m.popupContent || m.label || '');

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat(m.lngLat)
				.setPopup(popup)
				.addTo(map);
			
			el.addEventListener('mouseenter', () => marker.togglePopup());
			// el.addEventListener('mouseleave', () => marker.togglePopup()); // Optionnel

			markerInstances.push(marker);
		});
	}

	function drawZones(zonesData) {
		zonesData.forEach((zone, index) => {
			const sourceId = `zone-source-${index}`;
			const fillId = `zone-fill-${index}`;
			const lineId = `zone-line-${index}`;

			if (!map.getSource(sourceId)) {
				map.addSource(sourceId, { 'type': 'geojson', 'data': zone.geojson });

				map.addLayer({
					'id': fillId, 'type': 'fill', 'source': sourceId, 'layout': {},
					'paint': { 'fill-color': zone.color || '#3b82f6', 'fill-opacity': 0.15 }
				});

				map.addLayer({
					'id': lineId, 'type': 'line', 'source': sourceId, 'layout': {},
					'paint': { 'line-color': zone.color || '#3b82f6', 'line-width': 2, 'line-opacity': 0.8 }
				});

				map.on('mouseenter', fillId, (e) => {
					map.getCanvas().style.cursor = 'pointer';
					new maplibregl.Popup({ closeButton: false, className: 'zone-popup' })
						.setLngLat(e.lngLat)
						.setHTML(`<div class="text-black font-bold px-2">${zone.name}</div>`)
						.addTo(map);
				});
				map.on('mouseleave', fillId, () => map.getCanvas().style.cursor = '');
			}
		});
	}
</script>

<div class="relative w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-2xl {className}">
	<div bind:this={mapContainer} class="w-full h-full bg-[#16181d]" />
	<slot />
</div>

<style>
	:global(.maplibregl-ctrl-group) { background-color: #0f1115 !important; border: 1px solid rgba(255,255,255,0.1) !important; }
	:global(.maplibregl-ctrl-icon) { filter: invert(1); }
	:global(.maplibregl-popup-content) {
		background-color: #1a1d24; color: white;
		border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
		padding: 0; overflow: hidden;
		box-shadow: 0 4px 15px rgba(0,0,0,0.5);
	}
	:global(.maplibregl-popup-tip) { border-top-color: #1a1d24; }
	:global(.zone-popup .maplibregl-popup-content) { background: white; color: black; border: none; }
	:global(.zone-popup .maplibregl-popup-tip) { border-top-color: white; }
</style>