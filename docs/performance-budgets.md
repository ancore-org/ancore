# Extension Performance Budgets

Performance budgets for the Ancore wallet extension ensure consistent user experience on constrained devices and minimize extension impact on page load times.

## Budget Targets

All sizes are gzip-compressed:

| Bundle | Target | Rationale |
|--------|--------|-----------|
| popup.js | 150 KB | Popup script loaded on extension open |
| background.js | 120 KB | Background script runs continuously |
| content.js | 80 KB | Injected into every page |
| CSS assets | 50 KB | Shared styles |
| Total | 500 KB | Overall extension size limit |

## Motivation

- **Mobile performance**: Extension users often have limited bandwidth and memory
- **Page impact**: Content scripts injected into every page must be minimal
- **Cold startup**: Users expect extension to open in <500ms
- **Battery life**: Smaller footprint = less CPU, less battery drain

## CI Integration

Bundle size checks run on every pull request:

1. Build process generates gzipped bundles
2. `bundlewatch` compares against budgets in `.bundlewatch.json`
3. CI fails if any bundle exceeds budget
4. PR requires either bundle reduction or budget revision (with justification)

## Monitoring Regressions

### Automatic Detection
- CI gates catch size increases before merge
- `analyze-bundle.js` generates bundle reports
- Historical trend data available in CI artifacts

### Local Testing
```bash
# Build and analyze bundles
cd apps/extension-wallet
pnpm run build:analyze

# Review bundle composition
open dist/stats.html
```

## Optimization Strategies

### When Budgets are Exceeded

1. **Identify largest dependencies**
   - Open `dist/stats.html` after build
   - Look for unexpectedly large packages

2. **Common causes**
   - Duplicate dependencies (check `pnpm ls` output)
   - Unused imports (remove or tree-shake)
   - Heavy dependencies (consider lighter alternatives)
   - Polyfills (avoid if possible)

3. **Reduction techniques**
   - Dynamic imports for non-critical code
   - Lazy load heavy dependencies
   - Prefer native APIs over polyfills
   - Use minification and compression optimizations

### Justified Budget Increases

If a feature genuinely requires larger bundles:

1. **Propose budget increase in PR**
   - Link to issue/RFC for context
   - Explain why tradeoff is acceptable
   - Estimate user impact

2. **Update `.bundlewatch.json`**
   - Increment budget with comment
   - Include justification
   - Link to issue

3. **Example**
   ```json
   {
     "path": "apps/extension-wallet/dist/popup.js",
     "maxSize": "170kB",
     "compression": "gzip"
     // Increased from 150kB for improved wallet UI (RFC #42)
   }
   ```

## Bundle Report

After each build, `dist/bundle-report.json` contains:
- File paths and sizes
- Build timestamp
- Environment (dev/prod)

Use for trend analysis and performance tracking.

## Trend Reporting

### Quarterly Reviews
Monitor bundle size trends:
- Are budgets creeping up?
- Which bundles are growing fastest?
- Are optimizations effective?

### Data Sources
- `dist/bundle-report.json` from each release
- CI artifact history
- `bundlewatch` historical data (if configured)

## Tools

### Visualization
```bash
# Install rollup-plugin-visualizer if needed
pnpm add -D rollup-plugin-visualizer

# Build generates dist/stats.html
# Open in browser to explore bundle composition
```

### Bundlewatch
```bash
# Manual check (requires bundlewatch token in CI)
npx bundlewatch --config .bundlewatch.json

# Check specific branch
npx bundlewatch --config .bundlewatch.json --branch main
```

## References

- `.bundlewatch.json` - Budget configuration
- `apps/extension-wallet/scripts/analyze-bundle.js` - Analysis script
- `dist/stats.html` - Interactive bundle visualization (after build)
- `.github/workflows/ci.yml` - CI integration

## Next Steps

- Set up bundlewatch service account for CI (if using cloud service)
- Configure dashboard for trend analysis
- Add performance regression alerts to Slack/monitoring
- Establish monthly review cadence with team
