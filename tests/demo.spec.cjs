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

test('imagen de vista previa OG existe y es PNG', async ({ request }) => {
  const response = await request.get('/black-barber-og.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
});
