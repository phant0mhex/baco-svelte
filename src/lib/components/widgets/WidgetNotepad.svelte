<script>
  import { onMount } from 'svelte';
  import { Eraser, PenLine } from 'lucide-svelte';
  import { fade } from 'svelte/transition';

  // --- RUNES ---
  let { id, compact = false } = $props();

  let content = $state("");
  let saveStatus = $state("saved"); 
  let timeout;
  let textareaEl;

  const STORAGE_KEY = `baco_notepad_${id}`;

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        content = saved;
    }
    setTimeout(autoResize, 50);
  });

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = textareaEl.scrollHeight + 'px';
  }

  function handleInput() {
    saveStatus = "modified";
    autoResize();

    clearTimeout(timeout);
    timeout = setTimeout(() => {
        saveStatus = "saving";
        localStorage.setItem(STORAGE_KEY, content);
        setTimeout(() => saveStatus = "saved", 800);
    }, 1000);
  }

  function clearNote() {
    if(confirm("Effacer cette note ?")) {
        content = "";
        localStorage.removeItem(STORAGE_KEY);
        saveStatus = "saved";
        autoResize();
    }
  }
</script>

<div class="flex flex-col h-full bg-[#0f1115]/50 rounded-xl border border-white/5 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    <div class="flex justify-between items-center {compact ? 'px-2 py-1.5' : 'px-4 py-3'} border-b border-white/5 bg-white/5 shrink-0">
        <div class="flex items-center gap-2 text-yellow-400">
            <PenLine class="{compact ? 'w-3 h-3' : 'w-4 h-4'}" />
            {#if !compact}
                <span class="text-sm font-bold uppercase tracking-wider">Note Rapide</span>
            {:else}
                <span class="text-xs font-bold uppercase tracking-wider">Note</span>
            {/if}
        </div>
        
        <div class="flex items-center gap-2">
            {#if saveStatus === 'saving'}
                <span transition:fade class="text-[10px] text-blue-400 font-medium">Sauvegarde...</span>
            {:else if saveStatus === 'saved'}
                <span transition:fade class="text-[10px] text-green-500/50 font-medium">Enregistré</span>
            {/if}

            <button onclick={clearNote} class="p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors" title="Effacer">
                <Eraser class="{compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}" />
            </button>
        </div>
    </div>

    <div class="flex-grow relative w-full">
        <textarea 
            bind:this={textareaEl}
            bind:value={content}
            oninput={handleInput}
            placeholder="Numéro de bus, rappel, nom..."
            rows="1"
            class="w-full h-full min-h-full bg-transparent {compact ? 'p-2 text-xs' : 'p-4 text-sm'} text-gray-300 placeholder-gray-600 resize-none focus:outline-none custom-scrollbar leading-relaxed overflow-hidden block"
        ></textarea>
    </div>
</div>