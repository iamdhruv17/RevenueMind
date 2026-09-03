const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  // Wait for Suspense to stream in the stat card numbers (Neon cold start)
  try {
    await page.waitForFunction(() => document.querySelector('.font-mono.text-2xl')?.textContent?.trim().length > 0, { timeout: 20000 });
  } catch(e) { console.log('timeout waiting for numbers:', e.message); }
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'C:/Users/anura/.gemini/antigravity/brain/9d50489a-2f4a-479d-a45f-fbe0eee661ea/hero_polished.png', fullPage: false });
  console.log('hero done');
  await browser.close();
})();
