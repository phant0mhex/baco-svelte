<script>
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';

  let element;
  let editor;

  export let content = '<p>Votre procédure ici...</p>';

  onMount(() => {
    editor = new Editor({
      element: element,
      extensions: [
        StarterKit.configure({
            heading: {
                levels: [1, 2, 3],
            },
        }),
      ],
      content: content,
      onTransaction: () => {
        // Force la mise à jour de l'affichage des boutons
        editor = editor; 
      },
      onUpdate: ({ editor }) => {
        // Met à jour la variable content pour le parent
        content = editor.getHTML();
      }
    });
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });
</script>

<div class="editor-wrapper">
  {#if editor}
    <div class="toolbar">
      <button 
        on:click={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        class:active={editor.isActive('heading', { level: 3 })}
      >
        H3
      </button>

      <button 
        on:click={() => editor.chain().focus().toggleBold().run()}
        class:active={editor.isActive('bold')}
      >
        Gras
      </button>

      <button 
        on:click={() => editor.chain().focus().toggleBulletList().run()}
        class:active={editor.isActive('bulletList')}
      >
        Liste
      </button>
    </div>
  {/if}

  <div bind:this={element} class="editor-content" />
</div>

<style>
  .editor-wrapper {
    border: 1px solid #ccc;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
  }

  .toolbar {
    background: #f0f0f0;
    padding: 8px;
    border-bottom: 1px solid #ccc;
    display: flex;
    gap: 5px;
  }

  button {
    padding: 4px 8px;
    cursor: pointer;
    border: 1px solid #999;
    background: white;
    border-radius: 4px;
  }

  button.active {
    background: black;
    color: white;
  }

  /* Style global pour que les titres s'affichent bien DANS l'éditeur */
  .editor-content :global(.ProseMirror) {
    padding: 15px;
    min-height: 150px;
    outline: none;
  }

  .editor-content :global(h3) {
    font-size: 1.5em;
    font-weight: bold;
    margin-top: 1em;
    color: #333;
  }
  
  .editor-content :global(ul) {
    list-style: disc;
    margin-left: 1.5em;
  }
</style>