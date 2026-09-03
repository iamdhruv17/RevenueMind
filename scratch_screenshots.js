const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'C:/Users/anura/.gemini/antigravity/brain/9d50489a-2f4a-479d-a45f-fbe0eee661ea/landing_full.png', fullPage: true });
  console.log('full done');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'C:/Users/anura/.gemini/antigravity/brain/9d50489a-2f4a-479d-a45f-fbe0eee661ea/landing_hero.png', fullPage: false });
  console.log('hero done');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Users/anura/.gemini/antigravity/brain/9d50489a-2f4a-479d-a45f-fbe0eee661ea/dashboard_overview.png', fullPage: false });
  console.log('dashboard done');
  await browser.close();
})();
