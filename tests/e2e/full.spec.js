// ============================================================
//  Note Chord SoulCiety — Full E2E Test Suite
//  28 test cases across 8 groups
// ============================================================
const { test, expect } = require('@playwright/test');

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockUser = {
  uid: 'u-001', token: 'token-e2e', name: 'E2E Tester',
  email: 'e2e@example.com', role: 'member', package: 'free'
};

const mockAdmin = {
  uid: 'u-admin', token: 'token-admin', name: 'Admin User',
  email: 'admin@example.com', role: 'admin', package: 'gold'
};

// Sorted A-Z: Autumn Leaves, Blue Bossa, Hello Jazz
const mockSongs = [
  { name: 'Hello Jazz',    url: 'https://drive.google.com/file/d/aaa/preview' },
  { name: 'Blue Bossa',   url: 'https://drive.google.com/file/d/bbb/preview' },
  { name: 'Autumn Leaves',url: 'https://drive.google.com/file/d/ccc/preview' }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupMocks(page, opts = {}) {
  const user = opts.user || mockUser;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url     = new URL(request.url());
    const ep      = url.pathname.split('/').pop();
    const method  = request.method();

    const ok = body => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(body)
    });

    if (ep === 'auth') {
      if (method === 'POST') {
        const p = request.postDataJSON() || {};
        if (p.action === 'login') {
          if (opts.loginError)
            return ok({ success: false, error: opts.loginError });
          return ok({ success: true, data: user });
        }
        if (p.action === 'register') return ok({ success: true, data: { message: 'pending' } });
        if (p.action === 'logout')   return ok({ success: true, data: {} });
      }
      if (method === 'GET' && url.searchParams.get('action') === 'verify')
        return ok({ success: true, data: user });
    }

    if (ep === 'songs') return ok({ success: true, data: { songs: mockSongs } });

    if (ep === 'favorites') {
      if (method === 'GET') return ok({ success: true, data: { favorites: [] } });
      return ok({ success: true, data: { message: 'ok' } });
    }

    if (ep === 'recent') {
      if (method === 'GET') return ok({ success: true, data: { recent: [] } });
      return ok({ success: true, data: { message: 'ok' } });
    }

    if (ep === 'setlists') {
      if (method === 'GET') return ok({ success: true, data: { setlists: [] } });
      return ok({ success: true, data: { id: 'sl-1' } });
    }

    return ok({ success: true, data: {} });
  });
}

/** Inject a pre-built session so app.html loads without going through login */
async function injectSession(page, user = mockUser) {
  await page.addInitScript((u) => {
    sessionStorage.setItem('ncs-token', u.token);
    sessionStorage.setItem('ncs-user', JSON.stringify(u));
    // Clear caches so each test gets fresh data from mock API
    ['ncs-songs-cache','ncs-songs-cache-time','ncs-favorites','ncs-recent','ncs-setlists']
      .forEach(k => localStorage.removeItem(k));
  }, user);
}

/** Navigate to app.html and wait until it has fully initialised */
async function gotoApp(page) {
  await page.goto('/app.html');
  // Wait until renderUserInfo() has replaced "Loading…"
  await page.waitForFunction(
    () => {
      const el = document.getElementById('user-name');
      return el && el.textContent.trim() !== '' && el.textContent.trim() !== 'Loading…';
    },
    { timeout: 15000 }
  );
}

// ─── 1. Auth Page ─────────────────────────────────────────────────────────────

test.describe('1. Auth page', () => {

  test('1.1 login page loads with correct title', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/Note Chord SoulCiety/);
    await expect(page.locator('#form-login')).toBeVisible();
  });

  test('1.2 tab switching login ↔ register', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/index.html');
    await page.click('#tab-register');
    await expect(page.locator('#form-register')).toBeVisible();
    await page.click('#tab-login');
    await expect(page.locator('#form-login')).toBeVisible();
  });

  test('1.3 password visibility toggle', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/index.html');
    const pwInput = page.locator('#login-password');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.click('.pw-toggle[data-target="login-password"]');
    await expect(pwInput).toHaveAttribute('type', 'text');
    await page.click('.pw-toggle[data-target="login-password"]');
    await expect(pwInput).toHaveAttribute('type', 'password');
  });

  test('1.4 register shows pending approval message', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/index.html');
    await page.click('#tab-register');
    await page.fill('#reg-name', 'New Member');
    await page.fill('#reg-email', 'new@example.com');
    await page.fill('#reg-password', 'secret123');
    await page.click('#btn-register');
    await expect(page.locator('#msg-pending')).toHaveClass(/visible/);
  });

  test('1.5 login with wrong credentials shows error', async ({ page }) => {
    await setupMocks(page, { loginError: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    await page.goto('/index.html');
    await page.fill('#login-email', 'wrong@example.com');
    await page.fill('#login-password', 'wrongpass');
    await page.click('#btn-login');
    await expect(page.locator('#login-error')).toContainText('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  });

  test('1.6 login success redirects to app', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/index.html');
    await page.fill('#login-email', 'e2e@example.com');
    await page.fill('#login-password', 'password123');
    await page.click('#btn-login');
    await page.waitForURL(/\/app(\.html)?$/, { timeout: 15000 });
    await expect(page.locator('#user-name')).toContainText('E2E Tester');
  });

});

// ─── 2. App Initial Load ──────────────────────────────────────────────────────

test.describe('2. App initial load', () => {

  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await injectSession(page);
    await gotoApp(page);
  });

  test('2.1 shows user name in sidebar', async ({ page }) => {
    await expect(page.locator('#user-name')).toContainText('E2E Tester');
  });

  test('2.2 shows package badge', async ({ page }) => {
    await expect(page.locator('#user-package')).toContainText('Free');
  });

  test('2.3 admin nav hidden for member', async ({ page }) => {
    await expect(page.locator('#nav-admin')).toBeHidden();
  });

  test('2.4 library is default view', async ({ page }) => {
    await expect(page.locator('#topbar-title')).toContainText('คลังเพลง');
  });

  test('2.5 songs render as 3 grid cards', async ({ page }) => {
    await expect(page.locator('.song-card')).toHaveCount(3);
  });

});

// ─── 2b. Admin ───────────────────────────────────────────────────────────────

test.describe('2b. Admin role', () => {

  test('2b.1 admin nav visible for admin role', async ({ page }) => {
    await setupMocks(page, { user: mockAdmin });
    await injectSession(page, mockAdmin);
    await gotoApp(page);
    await expect(page.locator('#nav-admin')).toBeVisible();
  });

});

// ─── 3. Library Interactions ──────────────────────────────────────────────────

test.describe('3. Library interactions', () => {

  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await injectSession(page);
    await gotoApp(page);
  });

  test('3.1 search filters to matching songs', async ({ page }) => {
    await page.fill('#search-input', 'hello');
    await page.waitForTimeout(350); // allow 200 ms debounce
    await expect(page.locator('.song-card')).toHaveCount(1);
    await expect(page.getByText('Hello Jazz')).toBeVisible();
  });

  test('3.2 Escape clears search and restores all songs', async ({ page }) => {
    await page.fill('#search-input', 'hello');
    await page.waitForTimeout(350);
    await expect(page.locator('.song-card')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.song-card')).toHaveCount(3);
  });

  test('3.3 switch to list view renders song-rows', async ({ page }) => {
    await page.click('.topbar-view-toggle .topbar-btn[data-view="list"]');
    await expect(page.locator('.song-row')).toHaveCount(3);
    await expect(page.locator('.library-grid')).toHaveCount(0);
  });

  test('3.4 switch back to grid view renders song-cards', async ({ page }) => {
    await page.click('.topbar-view-toggle .topbar-btn[data-view="list"]');
    await page.click('.topbar-view-toggle .topbar-btn[data-view="grid"]');
    await expect(page.locator('.song-card')).toHaveCount(3);
    await expect(page.locator('.library-list')).toHaveCount(0);
  });

  test('3.5 sort Z-A puts Hello Jazz first', async ({ page }) => {
    await page.click('#sort-btn');
    await page.click('[data-sort="za"]');
    const first = await page.locator('.song-card-title').first().textContent();
    expect(first.trim()).toBe('Hello Jazz');
  });

  test('3.6 sort A-Z puts Autumn Leaves first', async ({ page }) => {
    await page.click('#sort-btn');
    await page.click('[data-sort="za"]');
    await page.click('#sort-btn');
    await page.click('[data-sort="az"]');
    const first = await page.locator('.song-card-title').first().textContent();
    expect(first.trim()).toBe('Autumn Leaves');
  });

  test('3.7 alphabet filter A shows only Autumn Leaves', async ({ page }) => {
    await page.click('.alpha-btn[data-alpha="A"]');
    await expect(page.locator('.song-card')).toHaveCount(1);
    await expect(page.getByText('Autumn Leaves')).toBeVisible();
  });

  test('3.8 alphabet filter "All" resets to all songs', async ({ page }) => {
    await page.click('.alpha-btn[data-alpha="A"]');
    await expect(page.locator('.song-card')).toHaveCount(1);
    await page.click('.alpha-btn[data-alpha=""]');
    await expect(page.locator('.song-card')).toHaveCount(3);
  });

  test('3.9 stats bar shows correct count', async ({ page }) => {
    await expect(page.locator('.content-stats-count')).toContainText('3');
  });

});

// ─── 4. Navigation ────────────────────────────────────────────────────────────

test.describe('4. Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await injectSession(page);
    await gotoApp(page);
  });

  test('4.1 favorites nav shows empty state', async ({ page }) => {
    await page.click('.nav-item[data-view="favorites"]');
    await expect(page.locator('#topbar-title')).toContainText('รายการโปรด');
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('4.2 recent nav shows empty state', async ({ page }) => {
    await page.click('.nav-item[data-view="recent"]');
    await expect(page.locator('#topbar-title')).toContainText('เพลงล่าสุด');
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('4.3 setlists nav shows empty state', async ({ page }) => {
    await page.click('.nav-item[data-view="setlists"]');
    await expect(page.locator('#topbar-title')).toContainText('Setlists');
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('4.4 livemode nav updates topbar title', async ({ page }) => {
    await page.click('.nav-item[data-view="livemode"]');
    await expect(page.locator('#topbar-title')).toContainText('Live Mode');
  });

  test('4.5 settings nav shows password change form', async ({ page }) => {
    await page.click('.nav-item[data-view="settings"]');
    await expect(page.locator('#topbar-title')).toContainText('เปลี่ยนรหัสผ่าน');
    await expect(page.locator('#btn-change-pw')).toBeVisible();
  });

  test('4.6 library nav returns to library view', async ({ page }) => {
    await page.click('.nav-item[data-view="favorites"]');
    await page.click('.nav-item[data-view="library"]');
    await expect(page.locator('#topbar-title')).toContainText('คลังเพลง');
    await expect(page.locator('.song-card')).toHaveCount(3);
  });

});

// ─── 5. Favorites ─────────────────────────────────────────────────────────────

test.describe('5. Favorites', () => {

  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await injectSession(page);
    await gotoApp(page);
  });

  test('5.1 toggling favorite updates sidebar badge', async ({ page }) => {
    await page.locator('.song-card-fav').first().click();
    await expect(page.locator('#fav-badge')).toBeVisible({ timeout: 5000 });
  });

  test('5.2 favorited song appears in favorites view', async ({ page }) => {
    await page.locator('.song-card-fav').first().click();
    await page.click('.nav-item[data-view="favorites"]');
    // Optimistic update already added 1 song to Favorites.list
    await expect(page.locator('.song-card, .song-row')).toHaveCount(1);
  });

});

// ─── 6. Theme Toggle ──────────────────────────────────────────────────────────

test.describe('6. Theme toggle', () => {

  test('6.1 theme toggle on login page changes data-theme', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/index.html');
    const html   = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.click('#auth-theme-btn');
    const after  = await html.getAttribute('data-theme');
    expect(after).not.toBe(before);
  });

  test('6.2 theme toggle on app page changes data-theme', async ({ page }) => {
    await setupMocks(page);
    await injectSession(page);
    await gotoApp(page);
    const html   = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.click('#theme-btn');
    const after  = await html.getAttribute('data-theme');
    expect(after).not.toBe(before);
  });

});

// ─── 7. Logout ────────────────────────────────────────────────────────────────

test.describe('7. Logout', () => {

  test('7.1 logout redirects back to login page', async ({ page }) => {
    // Use full login flow — avoids addInitScript re-injecting session after logout
    await setupMocks(page);
    await page.goto('/index.html');
    await page.fill('#login-email', 'e2e@example.com');
    await page.fill('#login-password', 'password123');
    await page.click('#btn-login');
    await page.waitForURL(/\/app(\.html)?$/, { timeout: 15000 });

    await page.click('#btn-logout');
    await page.waitForSelector('#form-login', { timeout: 10000 });
    await expect(page.locator('#form-login')).toBeVisible();
  });

});

// ─── 8. Password Change Validation ───────────────────────────────────────────

test.describe('8. Password change validation', () => {

  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await injectSession(page);
    await gotoApp(page);
    await page.click('.nav-item[data-view="settings"]');
    await expect(page.locator('#btn-change-pw')).toBeVisible();
  });

  test('8.1 empty fields shows error', async ({ page }) => {
    await page.click('#btn-change-pw');
    await expect(page.locator('#pw-message')).toContainText('กรอกข้อมูลให้ครบ');
  });

  test('8.2 new password too short shows error', async ({ page }) => {
    await page.fill('#old-password', 'oldpass123');
    await page.fill('#new-password', '123');
    await page.fill('#confirm-password', '123');
    await page.click('#btn-change-pw');
    await expect(page.locator('#pw-message')).toContainText('อย่างน้อย 6 ตัวอักษร');
  });

  test('8.3 mismatched passwords shows error', async ({ page }) => {
    await page.fill('#old-password', 'oldpass123');
    await page.fill('#new-password', 'newpass123');
    await page.fill('#confirm-password', 'different456');
    await page.click('#btn-change-pw');
    await expect(page.locator('#pw-message')).toContainText('ไม่ตรงกัน');
  });

});
