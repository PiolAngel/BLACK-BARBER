const { test, expect } = require('@playwright/test');

test('la página carga sin errores de JavaScript', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reserva demostrativa: previsualiza sin enviar mensajes', async ({ page }) => {
  await page.goto('/#contacto-demo');
  const select = page.locator('#demoService');
  await expect(select.locator('option')).toHaveCount(7);
  await select.selectOption({ label: 'Corte + barba' });
  await expect(page.locator('#demoMessage')).toHaveValue(/Corte \+ barba/);
  await page.locator('#demoBooking button[type="submit"]').click();
  await expect(page.locator('#demoStatus')).not.toBeEmpty();
});

test('las redes muestran información de demostración', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-demo-social="Instagram"]').click();
  await expect(page.locator('#socialDialog')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#socialClose').click();
  await expect(page.locator('#socialDialog')).toHaveAttribute('aria-hidden', 'true');
});

test('el menú móvil puede abrirse y cerrarse', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('#navToggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('imagen de vista previa OG existe, se decodifica y mide 1200 × 630', async ({ page, request }) => {
  const response = await request.get('/black-barber-og.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
  await page.goto('/');
  const dimensions = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/black-barber-og.png';
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(dimensions).toEqual({ width: 1200, height: 630 });
  // Diagnóstico de calidad: la paleta real del PNG permite detectar posterización excesiva.
  const paletteSize = await page.evaluate(async () => {
    const img = new Image();
    img.src = '/black-barber-og.png';
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
    }
    return colors.size;
  });
  console.log('OG diagnostic: unique RGB colors =', paletteSize);
});

test('Open Graph y Twitter apuntan al logo público, no a la galería', async ({ page }) => {
  await page.goto('/');
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content');
  expect(ogImage).toBe('https://black-barber-demo-five.vercel.app/black-barber-og.png');
  expect(twitterImage).toBe(ogImage);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /BLACK BARBER/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /demostración/i);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /^data:image\/svg\+xml/);
});

test('no hay scroll horizontal en tamaños móviles y tablet, con menú cerrado y abierto', async ({ page }) => {
  for (const width of [320, 360, 390, 430, 520, 521, 640, 768, 820, 860, 861, 900, 980, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const inspect = async (state) => {
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        overflows: [...document.querySelectorAll('body *')].filter(el => {
          const r=el.getBoundingClientRect();
          const style=getComputedStyle(el);
          return r.right > innerWidth+2 && style.position !== 'fixed' && style.visibility !== 'hidden';
        }).slice(0,8).map(el=>({ tag:el.tagName, cls:String(el.className).slice(0,80) }))
      }));
      expect(metrics.document, JSON.stringify({width,state,metrics})).toBeLessThanOrEqual(metrics.viewport + 1);
    };
    await inspect('closed');
    if (width <= 860) {
      await page.locator('#navToggle').click();
      await inspect('open');
      await page.locator('#navToggle').click();
      await inspect('closed-again');
    }
  }
});
