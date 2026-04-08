#!/usr/bin/env node
/**
 * Patches ios/App/App/capacitor.config.json after `npx cap sync` to include
 * custom native plugins (like AppleSignInPlugin) that aren't in node_modules
 * and therefore not auto-discovered by Capacitor.
 */
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'ios', 'App', 'App', 'capacitor.config.json');
const CUSTOM_PLUGINS = ['AppleSignInPlugin', 'CloudKitPlugin'];

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const existing = config.packageClassList || [];

  let changed = false;
  for (const plugin of CUSTOM_PLUGINS) {
    if (!existing.includes(plugin)) {
      existing.unshift(plugin);
      changed = true;
    }
  }

  if (changed) {
    config.packageClassList = existing;
    fs.writeFileSync(configPath, JSON.stringify(config, null, '\t') + '\n');
    console.log(`✔ Patched capacitor.config.json with custom plugins: ${CUSTOM_PLUGINS.join(', ')}`);
  } else {
    console.log('✔ Custom plugins already present in capacitor.config.json');
  }
} catch (err) {
  console.error('✘ Failed to patch capacitor.config.json:', err.message);
  process.exit(1);
}
