#!/usr/bin/env node
import { generatePortfolioManifest } from './generate_portfolio_manifest.mjs';

(async () => {
  try {
    const data = await generatePortfolioManifest({ silent: true });
    console.log(`Portfolio manifest updated for ${data.folders.length} folders.`);
  } catch (error) {
    console.error('Unable to update portfolio manifest:', error);
    process.exitCode = 1;
  }
})();
