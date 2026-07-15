import { useEffect, type RefObject } from 'react';

export function useDismissableDetails(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const details = ref.current;
      if (event.key !== 'Escape' || !details?.open) return;

      event.preventDefault();
      event.stopPropagation();
      details.removeAttribute('open');
      details.querySelector<HTMLElement>('summary')?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const details = ref.current;
      if (!details?.open || details.contains(event.target as Node)) return;
      details.removeAttribute('open');
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [ref]);
}
