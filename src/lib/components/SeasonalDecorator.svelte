<script>
    import { currentThemeId } from '$lib/stores/theme';
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';

    // Pour l'effet Matrix (Hacker), on génère des colonnes aléatoires
    let matrixColumns = Array(20).fill(0).map(() => Math.random() * 100);
</script>

<div class="fixed inset-0 pointer-events-none z-[1] overflow-hidden select-none">
    
    {#if $currentThemeId === 'christmas'}
        <div transition:fade>
            {#each Array(50) as _, i}
                <div class="snowflake" style="--delay: {Math.random() * 5}s; --left: {Math.random() * 100}%; --duration: {5 + Math.random() * 5}s; --size: {Math.random() * 5 + 2}px;"></div>
            {/each}
        </div>
    {/if}

    {#if $currentThemeId === 'halloween'}
        <div transition:fade>
            <div class="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-purple-900/20 to-transparent fog-anim"></div>
            {#each Array(6) as _, i}
                <div class="bat" style="--left: {Math.random() * 90}%; --delay: {Math.random() * 10}s; --scale: {0.5 + Math.random() * 0.5}">
                    <svg viewBox="0 0 100 50" class="w-12 h-6 fill-black/60 drop-shadow-[0_0_5px_rgba(255,165,0,0.4)]"><path d="M50 25 C 20 25 20 0 0 20 C 20 30 20 50 50 40 C 80 50 80 30 100 20 C 80 0 80 25 50 25 z" /></svg>
                </div>
            {/each}
        </div>
    {/if}

    {#if $currentThemeId === 'easter'}
        <div transition:fade>
            {#each Array(20) as _, i}
                <div class="petal" style="--left: {Math.random() * 100}%; --delay: {Math.random() * 10}s; --color: {['#FFB7B2', '#B5EAD7', '#E2F0CB', '#FFDAC1'][Math.floor(Math.random() * 4)]}"></div>
            {/each}
        </div>
    {/if}

    {#if $currentThemeId === 'ocean'}
        <div transition:fade>
            {#each Array(15) as _, i}
                <div class="bubble" 
                     style="
                        --left: {Math.random() * 100}%; 
                        --size: {5 + Math.random() * 15}px; 
                        --duration: {10 + Math.random() * 10}s; 
                        --delay: {Math.random() * 10}s;
                     ">
                </div>
            {/each}
            <div class="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-blue-900/10 mix-blend-overlay animate-pulse-slow"></div>
        </div>
    {/if}

    {#if $currentThemeId === 'forest' || $currentThemeId === 'aurora'}
        <div transition:fade>
            {#each Array(25) as _, i}
                <div class="firefly"
                     style="
                        --top: {Math.random() * 100}%;
                        --left: {Math.random() * 100}%;
                        --delay: {Math.random() * 5}s;
                        --duration: {5 + Math.random() * 5}s;
                     ">
                </div>
            {/each}
            {#if $currentThemeId === 'aurora'}
                <div class="aurora-light"></div>
            {/if}
        </div>
    {/if}

    {#if $currentThemeId === 'hacker'}
        <div transition:fade class="opacity-30">
            {#each matrixColumns as left, i}
                <div class="matrix-column" 
                     style="left: {left}%; animation-duration: {2 + Math.random() * 3}s; animation-delay: {Math.random() * 2}s;">
                    {'10'.repeat(20)}
                </div>
            {/each}
        </div>
    {/if}

    {#if $currentThemeId === 'retrowave' || $currentThemeId === 'cyberpunk' || $currentThemeId === 'neon'}
        <div transition:fade>
            {#if $currentThemeId === 'retrowave'}
                <div class="retro-sun"></div>
            {/if}
            
            <div class="synthwave-grid"></div>
            
            <div class="scanlines"></div>
        </div>
    {/if}

    {#if $currentThemeId === 'summer' || $currentThemeId === 'sunset'}
        <div transition:fade>
            <div class="sun-flare"></div>
            {#each Array(10) as _, i}
                <div class="dust-mote" 
                     style="--top: {Math.random() * 100}%; --left: {Math.random() * 100}%; --delay: {Math.random() * 5}s;">
                </div>
            {/each}
        </div>
    {/if}

</div>

<style>
    /* --- COMMUN --- */
    .opacity-30 { opacity: 0.3; }

    /* --- NOËL --- */
    .snowflake { position: absolute; top: -10px; left: var(--left); background: white; border-radius: 50%; opacity: 0.5; width: var(--size); height: var(--size); animation: fall var(--duration) linear infinite; animation-delay: var(--delay); }
    @keyframes fall { to { transform: translateY(110vh) translateX(20px); opacity: 0; } }

    /* --- HALLOWEEN --- */
    .fog-anim { animation: fogPulse 8s infinite alternate ease-in-out; }
    @keyframes fogPulse { from { opacity: 0.2; transform: scaleY(1); } to { opacity: 0.4; transform: scaleY(1.2); } }
    .bat { position: absolute; top: 10%; left: var(--left); transform: scale(var(--scale)); animation: batFly 20s linear infinite; animation-delay: var(--delay); opacity: 0; }
    @keyframes batFly { 
        0% { transform: translateX(0) translateY(0) rotate(0deg); opacity: 0; }
        10% { opacity: 0.6; }
        90% { opacity: 0.6; }
        100% { transform: translateX(-40vw) translateY(30vh) rotate(-15deg); opacity: 0; }
    }

    /* --- PÂQUES --- */
    .petal { position: absolute; top: -10px; left: var(--left); width: 12px; height: 12px; background: var(--color); border-radius: 10px 0 10px 0; opacity: 0.6; animation: petalFall 12s linear infinite; animation-delay: var(--delay); }
    @keyframes petalFall { 
        0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
        100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
    }

    /* --- OCEAN --- */
    .bubble {
        position: absolute; bottom: -20px; left: var(--left);
        width: var(--size); height: var(--size);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        animation: rise var(--duration) ease-in-out infinite;
        animation-delay: var(--delay);
    }
    @keyframes rise {
        0% { transform: translateY(0) translateX(0); opacity: 0; }
        10% { opacity: 0.5; }
        100% { transform: translateY(-110vh) translateX(20px); opacity: 0; }
    }
    .animate-pulse-slow { animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

    /* --- FOREST / AURORA (Lucioles) --- */
    .firefly {
        position: absolute; top: var(--top); left: var(--left);
        width: 4px; height: 4px;
        background: #ffff00;
        border-radius: 50%;
        box-shadow: 0 0 10px #ffff00;
        opacity: 0;
        animation: fireflyMove var(--duration) ease-in-out infinite alternate;
        animation-delay: var(--delay);
    }
    @keyframes fireflyMove {
        0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
        50% { opacity: 0.8; }
        100% { transform: translate(40px, -40px) scale(1); opacity: 0; }
    }
    .aurora-light {
        position: absolute; top: 0; left: 0; width: 100%; height: 40%;
        background: linear-gradient(180deg, rgba(16, 185, 129, 0.2) 0%, rgba(139, 92, 246, 0.1) 50%, transparent 100%);
        filter: blur(40px);
        opacity: 0.6;
        animation: auroraShift 10s infinite alternate;
    }
    @keyframes auroraShift { from { transform: scaleX(1); filter: hue-rotate(0deg); } to { transform: scaleX(1.2); filter: hue-rotate(30deg); } }

    /* --- HACKER (Matrix) --- */
    .matrix-column {
        position: absolute; top: -100%;
        color: #0f0;
        font-family: monospace;
        font-size: 14px;
        font-weight: bold;
        text-shadow: 0 0 5px #0f0;
        writing-mode: vertical-rl;
        text-orientation: upright;
        letter-spacing: 2px;
        white-space: nowrap;
        animation: matrixFall linear infinite;
        mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
    }
    @keyframes matrixFall { from { transform: translateY(0); } to { transform: translateY(150vh); } }

    /* --- RETROWAVE / CYBERPUNK --- */
    .synthwave-grid {
        position: absolute; bottom: 0; left: 0; width: 100%; height: 35vh;
        background-image: 
            linear-gradient(rgba(var(--color-primary), 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(var(--color-primary), 0.3) 1px, transparent 1px);
        background-size: 40px 40px;
        transform: perspective(300px) rotateX(60deg) scale(2);
        transform-origin: bottom center;
        animation: gridMove 2s linear infinite;
        mask-image: linear-gradient(to bottom, transparent 0%, black 40%);
    }
    @keyframes gridMove { from { background-position: 0 0; } to { background-position: 0 40px; } }
    
    .retro-sun {
        position: absolute; bottom: 20vh; left: 50%; transform: translateX(-50%);
        width: 150px; height: 150px;
        background: linear-gradient(to top, #ff00ff, #ffcc00);
        border-radius: 50%;
        box-shadow: 0 0 40px rgba(255, 0, 255, 0.6);
        mask-image: linear-gradient(to bottom, black 0%, black 60%, transparent 65%, transparent 70%, black 75%);
    }
    
    .scanlines {
        position: absolute; inset: 0;
        background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
        background-size: 100% 4px;
        pointer-events: none;
    }

    /* --- SUMMER --- */
    .sun-flare {
        position: absolute; top: -100px; right: -100px;
        width: 400px; height: 400px;
        background: radial-gradient(circle, rgba(253, 224, 71, 0.4) 0%, rgba(249, 115, 22, 0.1) 50%, transparent 70%);
        filter: blur(40px);
        animation: sunPulse 10s infinite alternate;
    }
    @keyframes sunPulse { from { transform: scale(1); opacity: 0.8; } to { transform: scale(1.1); opacity: 1; } }
    
    .dust-mote {
        position: absolute; top: var(--top); left: var(--left);
        width: 2px; height: 2px; background: white; border-radius: 50%;
        opacity: 0.6;
        animation: dustFloat 10s infinite alternate;
        animation-delay: var(--delay);
    }
    @keyframes dustFloat { from { transform: translate(0,0); } to { transform: translate(20px, -20px); } }
</style>