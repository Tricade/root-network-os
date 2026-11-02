'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

/** Keyboard navigation must not scroll the brand out of the native client area. */
async function checkSidebar({ window, output }) {
  const contents = window.webContents;
  const bounds = window.getBounds();
  const zoom = contents.getZoomFactor();
  const cases = [];
  try {
    for (const [width, height, factor] of [
      [1050, 700, 1],
      [1440, 960, 1],
      [1440, 960, 1.25],
    ]) {
      window.setSize(width, height);
      contents.setZoomFactor(factor);
      const result = await contents.executeJavaScript(`(async () => {
        const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await frame();
        const sidebar = document.querySelector('.sidebar');
        const brand = sidebar.querySelector('.brand');
        const controls = [...sidebar.querySelectorAll('button')];
        const failures = [];
        for (const button of controls) {
          button.focus();
          // focus() scrolls synchronously; reading bounds flushes layout. Waiting
          // for a paint per control needlessly multiplies hidden-window delays.
          const b = button.getBoundingClientRect();
          const logo = brand.getBoundingClientRect();
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          if (logo.top < 0 || logo.bottom > innerHeight || !button.contains(hit))
            failures.push({ control: button.textContent.trim(), logoTop: logo.top, logoBottom: logo.bottom, reachable: button.contains(hit) });
        }
        return { viewport: [innerWidth, innerHeight], controls: controls.length, failures,
          brandTop: brand.getBoundingClientRect().top, sidebarScroll: sidebar.scrollTop };
      })()`);
      cases.push({ width, height, zoom: factor, ...result });
      await fs.writeFile(path.join(output, 'sidebar.json'), JSON.stringify(cases, null, 2) + '\n');
      await fs.writeFile(
        path.join(output, `sidebar-${width}-${factor}.png`),
        (await contents.capturePage()).toPNG(),
      );
    }
    for (const item of cases) {
      assert.ok(item.controls > 10, 'Exercise the complete sidebar, including its footer');
      assert.deepEqual(
        item.failures,
        [],
        `Sidebar must retain its logo and reachable controls at ${item.width}px / ${item.zoom}x`,
      );
    }
    return cases;
  } finally {
    contents.setZoomFactor(zoom);
    window.setBounds(bounds);
  }
}

module.exports = { checkSidebar };
