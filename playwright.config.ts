import { defineConfig, devices } from '@playwright/test'

declare const process: {
  env: Record<string, string | undefined>
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const shouldStartLocalServer = baseURL.indexOf('http://127.0.0.1') === 0 || baseURL.indexOf('http://localhost') === 0

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-edge',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',
      },
    },
    {
      name: 'mobile-edge',
      use: {
        ...devices['Pixel 5'],
        channel: 'msedge',
      },
    },
  ],
  webServer: shouldStartLocalServer
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
})
