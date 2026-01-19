import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onNew?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if we're typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+N - New (works everywhere except when typing)
      // Use event.code for consistent detection regardless of Caps Lock or Shift
      if (
        event.ctrlKey &&
        (event.code === 'KeyN' || event.key.toLowerCase() === 'n') &&
        !isTyping
      ) {
        event.preventDefault();
        event.stopPropagation();
        handlers.onNew?.();
        return;
      }

      // Escape - Close modal/cancel (only when not in input or when input is empty)
      if (event.key === 'Escape') {
        // Don't prevent default for Escape when typing - let it work normally
        if (!isTyping || (target as HTMLInputElement).value === '') {
          handlers.onEscape?.();
        }
        return;
      }
    },
    [handlers]
  );

  useEffect(() => {
    // Use capture phase to catch event before browser default actions
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);
}
