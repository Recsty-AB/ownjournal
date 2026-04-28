#!/usr/bin/env node
/**
 * Patches ios/App/App/capacitor.config.json after `npx cap sync` to include
 * custom native plugins (like AppleSignInPlugin) that aren't in node_modules
 * and therefore not auto-discovered by Capacitor.
 */
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'ios', 'App', 'App', 'capacitor.config.json');
const CUSTOM_PLUGINS = ['AppleSignInPlugin', 'CloudKitPlugin', 'OwnJournalQrScannerPlugin'];
// Plugin classes that come from npm packages but have no iOS implementation
// in this project's SPM setup — the JS layer routes around them on iOS.
const PLUGINS_TO_REMOVE = ['BarcodeScannerPlugin'];

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const existing = config.packageClassList || [];

  let changed = false;
  let next = existing.filter((plugin) => {
    if (PLUGINS_TO_REMOVE.includes(plugin)) {
      changed = true;
      return false;
    }
    return true;
  });
  for (const plugin of CUSTOM_PLUGINS) {
    if (!next.includes(plugin)) {
      next.unshift(plugin);
      changed = true;
    }
  }

  if (changed) {
    config.packageClassList = next;
    fs.writeFileSync(configPath, JSON.stringify(config, null, '\t') + '\n');
    console.log(`✔ Patched capacitor.config.json: added ${CUSTOM_PLUGINS.join(', ')}; removed ${PLUGINS_TO_REMOVE.join(', ')}`);
  } else {
    console.log('✔ capacitor.config.json plugin list already up to date');
  }
} catch (err) {
  console.error('✘ Failed to patch capacitor.config.json:', err.message);
  process.exit(1);
}
