/** Original four-sheet portrait library. Identity is persisted, never derived from a name. */
export function portraitMarkup(agent, roleClass = '') {
  const portrait = Number.isInteger(agent.profile?.portrait) ? agent.profile.portrait : 0;
  const index = Math.max(0, Math.min(63, portrait)),
    cell = index % 16;
  const x = ((cell % 4) * 100) / 3,
    y = (Math.floor(cell / 4) * 100) / 3;
  return `<div class="agent-avatar personnel-portrait ${roleClass}" aria-hidden="true" style="background-image:url('/asset-pack/textures/ui/personnel-${Math.floor(index / 16) + 1}.png');background-position:${x}% ${y}%"></div>`;
}
