import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'

/**
 * What the app does around the ride itself: a passenger says they are at the
 * pickup point and the driver sees it live, the driver notes afterwards who
 * did not turn up, the coming rides stay on screen with the network gone, and
 * a passkey signs an account in with no password typed.
 */

function attempt(info: TestInfo) {
  const n = info.retry + info.repeatEachIndex
  return (info.project.name === 'phone' ? 'P' : 'D') + (n ? String(n + 1) : '')
}

function toast(page: Page, text: string) {
  return page.getByRole('status').filter({ hasText: text })
}

interface Who {
  username: string
  first: string
  last: string
}

async function register(browser: Browser, who: Who, options: object): Promise<Page> {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('tab', { name: 'Register' }).click()
  await page.getByLabel('First name').fill(who.first)
  await page.getByLabel('Surname').fill(who.last)
  await page.getByLabel('Username').fill(who.username)
  await page.getByLabel('Password').fill('a-long-enough-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('radiogroup', { name: 'View' })).toBeVisible()
  // A new account gets the first-login tour, an overlay over the board.
  await page.getByRole('button', { name: 'Skip the tour' }).click()
  return page
}

async function post(page: Page, path: string, data: object) {
  const token = await page.evaluate(() => (JSON.parse(localStorage.getItem('karpul.auth') ?? '{}') as { token?: string }).token)
  const res = await page.request.post(path, { headers: { Authorization: `Bearer ${token}` }, data })
  expect(res.ok(), `${path}: ${res.status()} ${await res.text()}`).toBe(true)
  return res.json()
}

/** Today, as the app writes a day. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('at the pickup point, who did not turn up, and the rides with no connection', async ({ browser }, info) => {
  const options = info.project.use
  const tag = attempt(info)
  const dunja = await register(browser, { username: `dunja.${tag.toLowerCase()}`, first: 'Dunja', last: `Vozić ${tag}` }, options)
  const relja = await register(browser, { username: `relja.${tag.toLowerCase()}`, first: 'Relja', last: `Putnik ${tag}` }, options)
  const dunjaName = `Dunja Vozić ${tag}`

  // A ride today that left at midnight: its day, and already gone, whenever the test runs.
  const ride = await post(dunja, '/api/rides', {
    ride_date: today(),
    car_type: 'own',
    car_name: 'Green Yaris',
    origin: 'Beograd',
    destination: 'Novi Sad',
    departure_time: '00:00',
    seats: 2,
  })
  await post(relja, `/api/rides/${ride.id}/bookings`, { passenger_name: `Relja Putnik ${tag}` })

  const open = async (page: Page) => {
    const row = page.getByRole('button', { name: new RegExp(`${dunjaName} · Green Yaris`) })
    await expect(row).toBeVisible()
    if ((await row.getAttribute('aria-expanded')) !== 'true') await row.click()
  }
  await open(relja)
  await open(dunja)

  // Relja says he is there; Dunja's card shows it without a reload.
  await relja.getByRole('button', { name: "I'm at the pickup point" }).first().click()
  await expect(toast(relja, 'Dunja knows you’re there.').or(toast(relja, "Dunja knows you're there."))).toBeAttached()
  await expect(dunja.getByText('At the pickup point').first()).toBeVisible()
  // He can take it back; the driver cannot say it for him.
  await expect(relja.getByRole('button', { name: 'Not there after all' }).first()).toBeVisible()
  await expect(dunja.getByRole('button', { name: "I'm at the pickup point" })).toHaveCount(0)

  // The ride has left: Dunja notes that he did not turn up, and he sees the mark.
  await dunja.getByRole('button', { name: "Didn't turn up" }).first().click()
  await expect(toast(dunja, "Noted: Relja didn't turn up.")).toBeAttached()
  await expect(relja.getByText("Didn't turn up").first()).toBeVisible()
  await dunja.getByRole('button', { name: 'Turned up after all' }).first().click()
  await expect(relja.getByText("Didn't turn up")).toHaveCount(0)

  // On a phone the open ride is a screen of its own, over the board: back to the board first.
  if (info.project.name === 'phone') await relja.goBack()

  // The network goes: the board cannot load, and the ride is still there to read.
  await relja.context().setOffline(true)
  await relja.evaluate(() => window.dispatchEvent(new Event('focus')))
  const card = relja.getByRole('status', { name: 'No connection' })
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card).toContainText('Beograd')
  await expect(card).toContainText(`${dunjaName} drives`)
  await expect(card).toContainText('You get in at Beograd')

  // Back again: the card goes with the first load that answers.
  await relja.context().setOffline(false)
  await card.getByRole('button', { name: 'Try again' }).click()
  await expect(card).toHaveCount(0)
})

test('a passkey signs in with no password', async ({ browser }, info) => {
  const tag = attempt(info).toLowerCase()
  // A passkey is bound to a host name, and an IP address is not one: this test visits the server as localhost.
  const base = new URL(String(info.project.use.baseURL))
  const options = { ...info.project.use, baseURL: `http://localhost:${base.port}` }
  const page = await register(browser, { username: `kiki.${tag}`, first: 'Kiki', last: `Ključić ${tag.toUpperCase()}` }, options)

  // A phone's fingerprint reader, as far as Chromium is concerned.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })

  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.locator('.drawer-me').first().click()
  const sheet = page.getByRole('dialog', { name: 'Your account' })
  await sheet.getByRole('button', { name: 'Add a passkey on this device' }).click()
  await expect(toast(page, 'Passkey added')).toBeAttached()
  await expect(sheet.getByText('not used yet')).toBeVisible()

  await sheet.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Register' })).toBeVisible()

  // No username, no password: the authenticator knows whose passkey it holds.
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page.getByRole('radiogroup', { name: 'View' })).toBeVisible()
  if (await menu.isVisible()) await menu.click()
  await expect(page.locator('.drawer-me').first()).toContainText('Kiki')
})
