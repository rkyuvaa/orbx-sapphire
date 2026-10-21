# OrbX frontend

## Playwright cross-browser tests

Install JavaScript dependencies with `npm install`. Browser binaries are intentionally not downloaded by dependency installation. Install the browsers you intend to run with:

```bash
npx playwright install chromium firefox webkit
```

Run the public login smoke and responsive checks across Chromium, Firefox, WebKit, Pixel 7, iPhone 13, and iPad Pro 11:

```bash
npm run test:e2e
```

The suite starts Vite automatically at `http://127.0.0.1:3000`; set `PLAYWRIGHT_BASE_URL` to target an already-running non-production frontend instead.

`npm run test:e2e:auth` is an intentionally skipped scaffold unless `PLAYWRIGHT_AUTH_STORAGE_STATE` points to a pre-created authenticated storage-state file for a non-production account. It only navigates to the workspace and must not be used with production credentials. Create that state outside this suite so the suite never submits credentials or mutates backend data.
