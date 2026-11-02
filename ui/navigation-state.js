/** UI-only scroll memory. No rendering or simulation state belongs in the save file. */
export function createNavigationState() {
  const positions = new Map();
  return {
    remember(view, mode, value) {
      if (Number.isFinite(value)) positions.set(`${mode}/${view}`, Math.max(0, value));
    },
    restore(view, mode) {
      return positions.get(`${mode}/${view}`) || 0;
    },
  };
}
