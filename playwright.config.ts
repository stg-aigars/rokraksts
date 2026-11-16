import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT ?? 3000)
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    locale: 'lv-LV',
    trace: 'off',
  },
  // Mobile-first: telefona skats ir galvenais, galddators ir otrs.
  projects: [
    { name: 'telefons', use: { ...devices['Pixel 7'] } },
    { name: 'galddators', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: isCI ? 'npm run start' : 'npm run dev',
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
