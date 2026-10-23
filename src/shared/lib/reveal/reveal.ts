const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isFullyVisible = (element: HTMLElement) => {
  const { top, bottom } = element.getBoundingClientRect();

  return top >= 0 && bottom <= window.innerHeight;
};

export const revealElement = (element: HTMLElement | null | undefined) => {
  if (!element) return;

  if (!isFullyVisible(element)) {
    element.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  element.focus({ preventScroll: true });
};
