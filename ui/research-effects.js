/** Actual before/after factors, including diminishing returns and replacement doctrine. */
export const RESEARCH_EFFECT_LABELS = {
  work: 'Projektarbeit',
  risk: 'Störungsrisiko',
  wear: 'Hardwareverschleiß',
  onboarding: 'Einrichtung & Betreuung',
  patience: 'Kundengeduld',
  serviceEfficiency: 'Ressourcenbedarf',
  retentionBonus: 'Rückgewinnungschance',
  energy: 'Energiekosten',
  research: 'Laufende Forschungspunkte',
  aiReward: 'KI-Auftragsvergütung',
  inferenceIncome: 'KI-Inferenzumsatz',
  noticeCost: 'Kosten der Kundenankündigung',
  noticeLead: 'Vorlauf der Kundenankündigung',
};
export function researchEffectPreview(E, state, node) {
  if (!node?.effects) return [];
  const model = E.getResearch(state);
  const owned = new Set(state.lab.owned);
  for (const n of model.technologies)
    if (node.doctrine && n.doctrine === node.doctrine) owned.delete(n.id);
  owned.add(node.id);
  const before = E.getResearchEffects(state),
    after = E.getResearchEffects({ ...state, lab: { ...state.lab, owned: [...owned] } });
  return Object.keys(node.effects).map((key) => ({ key, before: before[key], after: after[key] }));
}
export function researchEffectTable(ctx, node) {
  const rows = researchEffectPreview(ctx.E, ctx.state, node);
  if (!rows.length) return '';
  const owned = ctx.state.lab.owned.includes(node.id);
  const format = new Intl.NumberFormat(ctx.I18N?.getLanguage?.() === 'en' ? 'en-US' : 'de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
  return `<div class="research-effects"><h4>${ctx.tr(owned ? 'Aktive Wirkung' : 'Heute → nach Abschluss')}</h4>${rows
    .map(({ key, before, after }) => {
      const bonus = key === 'retentionBonus';
      const value = (n) =>
        bonus
          ? '+' + format.format(n * 100) + ' ' + ctx.tr('Prozentpunkte')
          : '×' + format.format(n);
      return `<div><span>${ctx.tr(RESEARCH_EFFECT_LABELS[key])}</span><strong>${owned ? value(before) : `${value(before)} → ${value(after)}`}</strong></div>`;
    })
    .join(
      '',
    )}<p>${ctx.tr('Gesamtfaktoren des Forschungsbaums. Versorgung, Personal und andere Ausbauten wirken zusätzlich.')}</p></div>`;
}
