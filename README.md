# motion2

## Updating the portfolio manifest

After adding or renaming folders and media inside the `Portfolio/` directory, run:

```bash
node scripts/update_portfolio_manifest.mjs
```

This regenerates `portfolio_manifest.json` so the site picks up your latest assets, feature-video links, and external URLs.

