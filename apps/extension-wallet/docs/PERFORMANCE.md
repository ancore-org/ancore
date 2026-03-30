# Performance Standards & Optimization

This document outlines the performance targets and optimization strategies for the Ancore Extension Wallet.

## 🎯 Performance Targets

- **Popup Load Time:** < 500ms
- **Total Bundle Size:** < 200KB (Uncompressed)
- **Memory Usage:** < 50MB
- **Frame Rate:** Consistent 60fps for animations

## 🛠 Optimization Techniques

### 1. Route-Based Code Splitting

All non-essential screens (Send, Receive, Settings) must be lazy-loaded using React `lazy` and `Suspense`.
_Benefit: Reduces the initial JS payload for the popup "cold start"._

### 2. Asset Management

- **Icons:** Use tree-shakable icons from `lucide-react`. Avoid importing the entire library.
- **Images:** All images should be compressed and, where possible, replaced with SVGs.

### 3. Dependency Management

- Before adding a new NPM package, run `pnpm run analyze` to check its impact.
- Prefer small, focused utilities over large "Swiss Army Knife" libraries.

## 📊 Monitoring

- **Manual Check:** Run `pnpm run analyze` in the extension-wallet directory.
- **CI/CD:** Bundlewatch is configured to fail PRs that exceed the 200KB threshold.
