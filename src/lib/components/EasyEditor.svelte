<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let value = ''; 
  export let id = 'markdown-editor';

  let textArea;
  let easyMDE;

  onMount(async () => {
    if (browser) {
      // 1. Import dynamique : On charge EasyMDE seulement ici, côté navigateur
      const EasyMDE = (await import('easymde')).default;
      
      // On peut aussi charger le CSS dynamiquement pour éviter tout conflit SSR
      // ou l'ajouter dans <svelte:head> plus bas
      
      easyMDE = new EasyMDE({
        element: textArea,
        initialValue: value,
        spellChecker: false,
        status: false,
        minHeight: "200px",
        toolbar: [
          "bold", "italic", "heading", "|", 
          "quote", "unordered-list", "ordered-list", "|", 
          "link", "|", "preview", "guide"
        ],
      });

      easyMDE.codemirror.on('change', () => {
        value = easyMDE.value();
      });
    }
  });

  $: if (easyMDE && value !== easyMDE.value()) {
    easyMDE.value(value);
  }

  onDestroy(() => {
    if (easyMDE) {
      easyMDE.toTextArea();
      easyMDE = null;
    }
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/easymde/dist/easymde.min.css">
</svelte:head>

<div class="easymde-wrapper">
  <textarea bind:this={textArea} {id}></textarea>
</div>

<style>
  .easymde-wrapper :global(.editor-toolbar) {
    z-index: 50;
  }
  .easymde-wrapper :global(.CodeMirror) {
    border-radius: 0 0 6px 6px;
  }
</style>