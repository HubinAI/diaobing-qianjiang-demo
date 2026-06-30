var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var _a;
import { defineConfig, devices } from '@playwright/test';
var baseURL = (_a = process.env.PLAYWRIGHT_BASE_URL) !== null && _a !== void 0 ? _a : 'http://127.0.0.1:5173';
var shouldStartLocalServer = baseURL.indexOf('http://127.0.0.1') === 0 || baseURL.indexOf('http://localhost') === 0;
export default defineConfig({
    testDir: './tests',
    timeout: 30000,
    expect: {
        timeout: 5000,
    },
    use: {
        baseURL: baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
    },
    projects: [
        {
            name: 'desktop-edge',
            use: __assign(__assign({}, devices['Desktop Chrome']), { channel: 'msedge' }),
        },
        {
            name: 'mobile-edge',
            use: __assign(__assign({}, devices['Pixel 5']), { channel: 'msedge' }),
        },
    ],
    webServer: shouldStartLocalServer
        ? {
            command: 'npm run dev',
            url: baseURL,
            reuseExistingServer: true,
            timeout: 120000,
        }
        : undefined,
});
