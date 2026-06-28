# Extension Build Troubleshooting Guide

Verified failure modes and fixes for the Ancore extension wallet build process.

> **Quick links:** [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/) | [Firefox WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/) | [Vite Troubleshooting](https://vitejs.dev/guide/troubleshooting.html)

---

## Issue 1: Service Worker Not Updating After Build

**Symptoms:**
- Changes to `src/background/` don't appear in the extension
- Old service worker code still running
- Chrome shows "Errors" in the service worker console

**Root Cause:**
Service workers are cached by the browser. Reloading the extension or bumping the manifest version is required.

**Fix:**

### Chrome
1. Open `chrome://extensions`
2. Find "Ancore Extension Wallet"
3. Click the **Reload** button (circular arrow icon)
4. Verify changes in the service worker console (right-click extension → "Inspect service worker")

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Find "Ancore Extension Wallet"
3. Click **Reload**
4. Check the console for errors

**Prevention:**
- Bump `manifest.json` version before each release: `"version": "0.1.1"`
- Use `pnpm build` before testing changes
- Clear extension data if issues persist: Settings → Extensions → Ancore → "Remove data"

---

## Issue 2: Manifest Validation Error

**Symptoms:**
```
Error: Invalid manifest
Manifest is not valid JSON
```

**Root Cause:**
- Syntax error in `manifest.json` (trailing comma, missing quote)
- Vite build failed to generate valid manifest
- Manifest schema mismatch (MV2 vs MV3)

**Fix:**

1. **Validate JSON syntax:**
   ```bash
   node -e "console.log(JSON.parse(require('fs').readFileSync('dist/manifest.json', 'utf8')))"
   ```

2. **Check for common errors:**
   - Trailing commas in JSON
   - Missing quotes around keys/values
   - Incorrect field types (string vs array)

3. **Verify MV3 compliance:**
   - `manifest_version` must be `3`
   - `background.service_worker` (not `background.scripts`)
   - `action` (not `browser_action` or `page_action`)

4. **Rebuild from scratch:**
   ```bash
   pnpm clean
   pnpm install
   pnpm build
   ```

**Prevention:**
- Run `pnpm build` before loading in browser
- Use a JSON linter in your editor
- Check `dist/manifest.json` before loading

---

## Issue 3: Vite Build Fails with "Cannot find module"

**Symptoms:**
```
Error: Cannot find module '@ancore/core-sdk'
Error: Cannot find module 'react'
```

**Root Cause:**
- Dependencies not installed
- Monorepo workspace not linked
- Incorrect import path

**Fix:**

1. **Reinstall dependencies:**
   ```bash
   pnpm install
   ```

2. **Verify workspace linking:**
   ```bash
   pnpm list @ancore/core-sdk
   ```
   Should show the local package, not npm registry.

3. **Check import paths:**
   - Relative imports: `import { foo } from '../utils'` ✅
   - Workspace imports: `import { foo } from '@ancore/core-sdk'` ✅
   - Avoid: `import { foo } from 'core-sdk'` ❌

4. **Clear build cache:**
   ```bash
   rm -rf dist node_modules/.vite
   pnpm build
   ```

**Prevention:**
- Run `pnpm install` after pulling changes
- Use workspace aliases in `tsconfig.json`
- Check `package.json` for correct dependency versions

---

## Issue 4: HMR (Hot Module Reload) Not Working in Development

**Symptoms:**
- Changes to React components don't reflect without full page reload
- Vite dev server running but no updates
- "Failed to fetch source map" errors in console

**Root Cause:**
- Vite dev server not running
- Extension not loaded from dev server
- CORS or network issues

**Fix:**

1. **Start dev server:**
   ```bash
   pnpm dev
   ```
   Should output: `VITE v5.x.x ready in XXX ms`

2. **Verify dev server is running:**
   ```bash
   curl http://localhost:5173
   ```
   Should return HTML (not connection refused)

3. **Reload extension:**
   - Chrome: `chrome://extensions` → Reload
   - Firefox: `about:debugging` → Reload

4. **Check browser console for errors:**
   - Right-click extension → "Inspect popup"
   - Look for network errors or CORS issues

5. **Restart dev server:**
   ```bash
   # Kill existing process
   pkill -f "vite"
   # Restart
   pnpm dev
   ```

**Prevention:**
- Keep dev server running in a separate terminal
- Use `pnpm dev` for development, `pnpm build` for production
- Check `vite.config.ts` for correct port configuration

---

## Issue 5: TypeScript Compilation Errors

**Symptoms:**
```
error TS2307: Cannot find module
error TS2339: Property 'X' does not exist
error TS7006: Parameter 'X' implicitly has an 'any' type
```

**Root Cause:**
- Missing type definitions
- Incorrect import paths
- Strict mode enabled without proper types

**Fix:**

1. **Run type check:**
   ```bash
   pnpm typecheck
   ```

2. **Fix common errors:**
   - Add type annotations: `const x: string = "hello"`
   - Import types: `import type { Foo } from '@ancore/types'`
   - Install missing `@types` packages: `pnpm add -D @types/node`

3. **Check `tsconfig.json`:**
   - `strict: true` requires all types to be explicit
   - `skipLibCheck: true` skips type checking of dependencies
   - `moduleResolution: "node"` for correct import resolution

4. **Rebuild:**
   ```bash
   pnpm build
   ```

**Prevention:**
- Run `pnpm typecheck` before committing
- Use strict mode in development
- Add type annotations to function parameters and returns

---

## Issue 6: CSS/Styling Not Applied in Extension

**Symptoms:**
- Styles from Tailwind CSS not appearing
- Inline styles work but class names don't
- Extension looks unstyled or broken

**Root Cause:**
- Tailwind CSS build not running
- CSS not bundled into extension
- Class names purged by Tailwind

**Fix:**

1. **Verify Tailwind is configured:**
   - Check `tailwind.config.js` exists
   - Check `postcss.config.js` exists
   - Verify `src/**/*.{tsx,ts}` is in `content` array

2. **Rebuild with CSS:**
   ```bash
   pnpm build
   ```

3. **Check dist output:**
   ```bash
   ls -la dist/
   # Should include CSS files or inline styles
   ```

4. **Verify class names in HTML:**
   - Right-click extension → "Inspect popup"
   - Check if `class="..."` attributes are present
   - Check if CSS is in `<style>` tags

5. **Clear browser cache:**
   - Chrome: `chrome://extensions` → Reload
   - Firefox: `about:debugging` → Reload

**Prevention:**
- Test styling in development with `pnpm dev`
- Use Tailwind's `@apply` for custom components
- Avoid dynamic class names (Tailwind can't purge them)

---

## Issue 7: Popup Window Doesn't Open or Shows Blank

**Symptoms:**
- Clicking extension icon does nothing
- Popup opens but is blank/white
- Console shows errors in popup context

**Root Cause:**
- Popup HTML not generated
- React app failed to mount
- JavaScript error in popup code

**Fix:**

1. **Check popup HTML exists:**
   ```bash
   ls -la dist/popup/index.html
   ```

2. **Inspect popup:**
   - Right-click extension icon → "Inspect popup"
   - Check console for JavaScript errors
   - Check Network tab for failed requests

3. **Verify React mount point:**
   - `dist/popup/index.html` should have `<div id="root"></div>`
   - `dist/popup/index.js` should call `ReactDOM.createRoot()`

4. **Check manifest popup configuration:**
   ```json
   {
     "action": {
       "default_popup": "popup/index.html",
       "default_title": "Ancore Wallet"
     }
   }
   ```

5. **Rebuild and reload:**
   ```bash
   pnpm build
   # Then reload extension in browser
   ```

**Prevention:**
- Test popup in development: `pnpm dev` → click extension
- Check console for errors before building
- Verify `vite.config.ts` includes popup entry point

---

## Issue 8: Background Service Worker Crashes or Stops Running

**Symptoms:**
- Service worker shows "Inactive" in Chrome
- Background tasks not executing
- Extension stops responding to messages

**Root Cause:**
- Unhandled error in service worker
- Service worker terminated after inactivity
- Memory leak or infinite loop

**Fix:**

1. **Inspect service worker:**
   - Chrome: `chrome://extensions` → "Inspect service worker"
   - Firefox: `about:debugging` → "Inspect" background script

2. **Check for errors:**
   - Look for red error messages in console
   - Check for unhandled promise rejections
   - Look for infinite loops or blocking code

3. **Add error handling:**
   ```typescript
   // In src/background/index.ts
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     try {
       // Handle message
       sendResponse({ success: true });
     } catch (error) {
       console.error('Message handler error:', error);
       sendResponse({ error: error.message });
     }
   });
   ```

4. **Avoid blocking operations:**
   - Use `async/await` instead of blocking calls
   - Don't use `while` loops without breaks
   - Offload heavy work to web workers if needed

5. **Reload extension:**
   - Chrome: `chrome://extensions` → Reload
   - Firefox: `about:debugging` → Reload

**Prevention:**
- Test service worker with `pnpm test`
- Add error boundaries and logging
- Monitor service worker console regularly
- Use `chrome.runtime.lastError` to catch errors

---

## Issue 9: Extension Permissions Denied or Not Requested

**Symptoms:**
- `chrome.storage` returns undefined
- `browser.storage` not available
- "Permission denied" errors in console

**Root Cause:**
- Permissions not declared in `manifest.json`
- Extension not reloaded after manifest change
- Incorrect permission name

**Fix:**

1. **Check manifest permissions:**
   ```json
   {
     "permissions": [
       "storage",
       "activeTab"
     ]
   }
   ```

2. **Verify permission names:**
   - `storage` — access `chrome.storage.local`
   - `activeTab` — access current tab
   - See [Chrome Permissions Reference](https://developer.chrome.com/docs/extensions/reference/permissions/)

3. **Reload extension:**
   - Chrome: `chrome://extensions` → Reload
   - Firefox: `about:debugging` → Reload

4. **Test permission access:**
   ```typescript
   chrome.storage.local.get(['key'], (result) => {
     console.log('Storage access:', result);
   });
   ```

**Prevention:**
- Declare all required permissions upfront
- Test permissions in development
- Use `chrome.runtime.lastError` to catch permission errors

---

## Issue 10: Build Output Size Too Large

**Symptoms:**
- `dist/` folder is > 5 MB
- Extension takes long to load
- Chrome warns about large extension

**Root Cause:**
- Unminified code in production build
- Duplicate dependencies
- Large assets not optimized

**Fix:**

1. **Check build output:**
   ```bash
   du -sh dist/
   ls -lh dist/**/*.js
   ```

2. **Verify production build:**
   ```bash
   pnpm build
   # Should use minification and tree-shaking
   ```

3. **Analyze bundle:**
   ```bash
   pnpm build --analyze
   # Or use: npm install -g vite-plugin-visualizer
   ```

4. **Optimize assets:**
   - Compress images: `pnpm add -D imagemin`
   - Remove unused dependencies
   - Use dynamic imports for large modules

5. **Check `vite.config.ts`:**
   ```typescript
   export default {
     build: {
       minify: 'terser',
       sourcemap: false, // Disable in production
     }
   }
   ```

**Prevention:**
- Monitor bundle size in CI
- Use `pnpm audit` to find unused dependencies
- Test production build locally before release

---

## Debugging Tips

### Enable Verbose Logging

Add to `src/background/index.ts`:
```typescript
const DEBUG = true;

function log(...args: any[]) {
  if (DEBUG) console.log('[Ancore]', ...args);
}
```

### Use Chrome DevTools

1. **Inspect popup:** Right-click extension → "Inspect popup"
2. **Inspect service worker:** `chrome://extensions` → "Inspect service worker"
3. **View extension files:** `chrome://extensions` → "Inspect views" → "service_worker.html"

### Use Firefox DevTools

1. **Inspect popup:** Right-click extension → "Inspect Popup"
2. **View console:** `about:debugging` → "Inspect" background script
3. **Check logs:** `about:addons` → Extension → "Debug"

### Test Locally

```bash
# Development with HMR
pnpm dev

# Production build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

---

## Related Documentation

- [Extension Architecture](../architecture/OVERVIEW.md)
- [E2E Smoke Tests](../testing/extension-e2e-smoke.md)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Firefox WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/)
- [Vite Documentation](https://vitejs.dev/)

---

## Contributing

Found a new issue? Please:

1. Document the symptoms and root cause
2. Provide a reproducible fix
3. Test the fix locally
4. Submit a PR to update this guide

---

_Last updated: 2026-05-29_
_Maintained by: Ancore Extension Team_
