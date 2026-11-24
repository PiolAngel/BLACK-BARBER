const { test, expect } = require('@playwright/test');

test('la página carga sin errores de JavaScript', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('consulta WhatsApp: servicio, edición y destinatario autorizado', async ({ page }) => {
  await page.goto('/#contacto-demo');
  const select = page.locator('#demoService');
  await expect(select.locator('option')).toHaveCount(7);
  await select.selectOption({ label: 'Corte + barba' });
  await page.locator('#demoName').fill('Martín');
  await page.locator('#demoWhen').fill('Viernes a la tarde');
  await expect(page.locator('#demoMessage')).toHaveValue(/Corte \+ barba/);
  await expect(page.locator('#demoMessage')).toHaveValue(/Martín/);
  await page.locator('#demoMessage').fill('Hola BLACK BARBER, consulto por Corte + barba. ¿Tienen hora el viernes?');
  await page.evaluate(() => {window.open = (url) => {window.__waCaptured = url;return null;};});
  await page.locator('#demoBooking button[type="submit"]').click();
  const url = await page.evaluate(() => window.__waCaptured);
  const parsed = new URL(url);
  expect(parsed.origin).toBe('https://wa.me');
  expect(parsed.pathname).toBe('/595981951940');
  expect(parsed.searchParams.get('text')).toBe('Hola BLACK BARBER, consulto por Corte + barba. ¿Tienen hora el viernes?');
  await expect(page.locator('#demoMessage')).toHaveValue(/¿Tienen hora el viernes/);
  await expect(page.locator('#demoStatus')).toContainText('decidís');
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
  await page.locator('#navClose').click();
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
  expect(paletteSize, 'La imagen OG no debe tener texto posterizado con paleta mínima').toBeGreaterThan(64);
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
    if (width <= 1023) {
      await page.locator('#navToggle').click();
      await inspect('open');
      await page.locator('#navClose').click();
      await inspect('closed-again');
    }
  }
});

test('menú móvil cubre viewport después de scroll y restaura desplazamiento', async ({ page }) => {
  for (const width of [390, 820]) {
    await page.setViewportSize({ width, height: 750 });
    await page.goto('/');
    for (const y of [450, 1400, 3200]) {
      // Simular a un usuario que ya terminó de desplazarse.
      // El sitio tiene scroll-behavior:smooth; sin desactivarlo la animación
      // sigue avanzando mientras se toma la medida inicial.
      await page.evaluate(y => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, y);
      }, y);
      await page.waitForTimeout(120);
      const before = await page.evaluate(() => window.scrollY);
      await page.locator('#navToggle').evaluate(el => el.click());
      const metrics = await page.locator('#primaryNav').evaluate(el => {
        const r = el.getBoundingClientRect();
        return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,viewportH:innerHeight,position:getComputedStyle(el).position,parent:el.parentElement.tagName};
      });
      expect(metrics.parent).toBe('BODY');
      expect(metrics.position).toBe('fixed');
      expect(metrics.top).toBe(0);
      expect(metrics.bottom).toBeGreaterThanOrEqual(metrics.viewportH - 2);
      await expect(page.locator('#navClose')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.body).position)).toBe('fixed');
      await page.locator('#navClose').evaluate(el => el.click());
      await expect(page.locator('#navToggle')).toHaveAttribute('aria-expanded','false');
      const after = await page.evaluate(() => window.scrollY);
      expect(Math.abs(after - before), JSON.stringify({width,y,before,after})).toBeLessThanOrEqual(2);
    }
  }
});

test('galería muestra seis fotografías distintas, accesibles y cargadas', async ({ page }) => {
  await page.goto('/');
  const images=page.locator('.gallery-item img');
  await expect(images).toHaveCount(6);
  const sources=await images.evaluateAll(nodes => nodes.map(n => n.src.split('?')[0]));
  expect(new Set(sources).size).toBe(6);
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(async () => img.evaluate(el => el.complete && el.naturalWidth > 0), {timeout:15000}).toBe(true);
    expect(await img.getAttribute('alt')).toBeTruthy();
  }
  const dimensions=await page.locator('.gallery-grid').evaluate(el=>({width:el.scrollWidth,client:el.clientWidth}));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.client+1);
});

test('galería mantiene dimensiones compactas en teléfono y escritorio', async ({page}) => {
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await page.locator('#galeria').scrollIntoViewIfNeeded();
    const sizes=await page.locator('.gallery-item').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
    for(const size of sizes) {
      expect(size.h,JSON.stringify({width,size})).toBeLessThanOrEqual(width===1440?400:width===820?320:220);
      expect(size.w).toBeGreaterThan(100);
    }
  }
});
