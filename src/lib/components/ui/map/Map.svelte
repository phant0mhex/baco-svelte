<script>
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapContainer;
	let map = $state(null);
    let markerInstances = [];

    // Props
	let { route = null, markers = [], className = '' } = $props();

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
			center: [4.3517, 50.8503],
			zoom: 8,
			attributionControl: false
		});

        // Contrôles de navigation (Zoom +/-) en bas à droite
		map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

        // AJOUT : Mode Plein Écran en haut à droite
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');

		map.on('load', () => {
			if (route) drawRoute(route);
            if (markers) drawMarkers(markers);
		});
	});

	onDestroy(() => {
		map?.remove();
	});

    // Réactivité
    $effect(() => {
        if (map && map.loaded()) {
            if (route) drawRoute(route);
            if (markers) drawMarkers(markers);
        }
    });

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

        const coordinates = routeData.geometry.coordinates;
        if (coordinates && coordinates.length > 0) {
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
            map.fitBounds(bounds, { padding: 50 });
        }
	}

    function drawMarkers(markersData) {
        markerInstances.forEach(m => m.remove());
        markerInstances = [];

        markersData.forEach(m => {
            const el = document.createElement('div');
            el.className = 'w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform';
            
            if (m.type === 'start') el.className = 'w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg z-10';
            if (m.type === 'end') el.className = 'w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg z-10';

            const popup = new maplibregl.Popup({ offset: 15, closeButton: false, closeOnClick: false }).setText(m.label);

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat(m.lngLat)
                .setPopup(popup)
                .addTo(map);
            
            el.addEventListener('mouseenter', () => marker.togglePopup());
            el.addEventListener('mouseleave', () => marker.togglePopup());

            markerInstances.push(marker);
        });
    }
</script>

<div class="relative w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-2xl {className}">
	<div bind:this={mapContainer} class="w-full h-full" />
    <slot />
</div>

<style>
    /* Styling pour adapter les contrôles MapLibre au thème sombre */
    :global(.maplibregl-ctrl-group) {
        background-color: #0f1115 !important; /* Fond sombre */
        border: 1px solid rgba(255,255,255,0.1) !important;
    }
    :global(.maplibregl-ctrl-icon) {
        filter: invert(1); /* Icônes blanches */
    }
    :global(.maplibregl-popup-content) {
        background-color: #1a1d24;
        color: white;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 5px 10px;
        font-size: 12px;
        font-weight: bold;
    }
    :global(.maplibregl-popup-tip) {
        border-top-color: #1a1d24;
    }
</style>