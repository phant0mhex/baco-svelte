<script>
    import { onMount } from 'svelte';
    import { MapPin, Wind, Sun, Cloud, CloudRain, CloudSnow, CloudLightning } from 'lucide-svelte';

    let weatherData = null;
    let loading = true;

    onMount(async () => {
        try {
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.4542&longitude=3.9567&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FBrussels');
            const data = await res.json();
            weatherData = data.current;
        } catch (e) { console.error(e); }
        loading = false;
    });

    function getWeatherIcon(code) {
        if (code === 0) return Sun;
        if (code >= 1 && code <= 3) return Cloud;
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
        if (code >= 71 && code <= 77) return CloudSnow;
        if (code >= 95) return CloudLightning;
        return Cloud;
    }
</script>

<div class="relative flex flex-col justify-between overflow-hidden h-full glass-panel p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
    <div class="absolute -right-6 -top-6 w-32 h-32 bg-orange-500/20 blur-[50px] rounded-full"></div>
    
    <div class="flex justify-between items-start mb-4 relative z-10">
        <div>
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <MapPin class="w-4 h-4 text-orange-400" /> Mons
            </h3>
            <p class="text-xs text-gray-400 uppercase tracking-wider mt-1">Météo en direct</p>
        </div>
        {#if !loading && weatherData}
            {@const WeatherIcon = getWeatherIcon(weatherData.weather_code)}
            <WeatherIcon class="w-10 h-10 text-orange-300 drop-shadow-[0_0_15px_rgba(253,186,116,0.6)]" />
        {/if}
    </div>

    <div class="relative z-10 mt-auto">
        {#if loading}
            <div class="animate-pulse space-y-2">
                <div class="h-8 w-20 bg-white/10 rounded"></div>
                <div class="h-4 w-32 bg-white/5 rounded"></div>
            </div>
        {:else if weatherData}
            <div class="flex items-end gap-2">
                <span class="text-5xl font-bold text-white tracking-tighter">{Math.round(weatherData.temperature_2m)}°</span>
                <span class="text-lg text-gray-400 mb-1.5 font-medium">C</span>
            </div>
            <div class="flex items-center gap-2 mt-2 text-sm text-gray-400">
                <Wind class="w-4 h-4" /> <span>{weatherData.wind_speed_10m} km/h</span>
            </div>
        {:else}
            <p class="text-sm text-red-400">Erreur météo</p>
        {/if}
    </div>
</div>