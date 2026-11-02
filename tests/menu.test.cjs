'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I18N = require('../i18n.js');

test('every route has one menu group and is reachable in web and room navigation', async () => {
  const {
    NAVIGATION_GROUPS,
    NAVIGATION_ITEMS,
    sidebarNavigation,
    consoleNavigation,
    navigationGroup,
  } = await import('../ui/navigation.js');
  const { createUIFoundation } = await import('../ui/foundation.js');
  const ids = NAVIGATION_ITEMS.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    createUIFoundation(I18N).navs.map(([id]) => id),
    ids,
  );
  assert.ok(ids.includes('achievements'));
  assert.equal(NAVIGATION_ITEMS.find(([id]) => id === 'achievements')[4], 'achievementCount');
  assert.equal(NAVIGATION_ITEMS.find(([id]) => id === 'research')[4], undefined);
  const sidebar = sidebarNavigation('business', () => '');
  for (const group of NAVIGATION_GROUPS)
    for (const [id, , , renderer] of group.items) {
      assert.ok(renderer.endsWith('View'));
      assert.ok(sidebar.includes(`data-nav="${id}"`));
      const console = consoleNavigation(id, (text) => I18N.translate(text, 'en'));
      assert.ok(console.includes(`data-nav="${id}"`));
      assert.equal((console.match(/aria-current="page"/g) || []).length, 1);
      assert.equal(navigationGroup(id).id, group.id);
      for (const other of NAVIGATION_GROUPS)
        assert.ok(console.includes(`data-nav="${other.items[0][0]}"`));
    }
  assert.equal(navigationGroup('unknown').id, NAVIGATION_GROUPS[0].id);
});

test('commercial, research and tooltip runtime text has complete English output', () => {
  for (const [source, english] of [
    ['Noch 3,482 FP nötig', '3,482 RP required'],
    [
      'Forschung abgeschlossen: Wissenssynthese, Stufe 5.',
      'Research complete: Knowledge synthesis, level 5.',
    ],
    [
      'Aster Labs / 17: Vertrag angenommen. Ein Agent muss den Dienst einrichten.',
      'Aster Labs / 17: Contract accepted. An agent must set up the service.',
    ],
    ['Kunden & Verträge', 'Customers & contracts'],
    ['Gebäude & Versorgung', 'Buildings & utilities'],
  ])
    assert.equal(I18N.translate(source, 'en'), english);
});
