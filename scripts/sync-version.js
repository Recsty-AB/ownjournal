#!/usr/bin/env node
/**
 * Version Sync Script
 * 
 * Reads the version from package.json and updates native platform files
 * (Android build.gradle and iOS project settings) to ensure all platforms
 * use the same version number.
 * 
 * Usage: npm run sync-version
 * 
 * Version Code Calculation:
 * - Format: MAJOR * 10000 + MINOR * 100 + PATCH
 * - Example: 1.2.3 = 10203
 * - Example: 1.0.0 = 10000
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Parse version components
const versionParts = version.split('.');
const major = parseInt(versionParts[0], 10) || 0;
const minor = parseInt(versionParts[1], 10) || 0;
const patch = parseInt(versionParts[2], 10) || 0;

// Calculate version code (Android requires an integer)
const versionCode = major * 10000 + minor * 100 + patch;

console.log('');
console.log('📦 Version Sync');
console.log('================');
console.log(`Version: ${version}`);
console.log(`Version Code: ${versionCode}`);
console.log('');

// Update Android build.gradle
const androidGradlePath = path.join(__dirname, '../android/app/build.gradle');
if (fs.existsSync(androidGradlePath)) {
  let gradle = fs.readFileSync(androidGradlePath, 'utf8');
  
  // Replace versionCode
  const versionCodeRegex = /versionCode\s+\d+/;
  if (versionCodeRegex.test(gradle)) {
    gradle = gradle.replace(versionCodeRegex, `versionCode ${versionCode}`);
  }
  
  // Replace versionName
  const versionNameRegex = /versionName\s+"[^"]+"/;
  if (versionNameRegex.test(gradle)) {
    gradle = gradle.replace(versionNameRegex, `versionName "${version}"`);
  }
  
  fs.writeFileSync(androidGradlePath, gradle);
  console.log('✅ Updated android/app/build.gradle');
  console.log(`   versionCode: ${versionCode}`);
  console.log(`   versionName: "${version}"`);
} else {
  console.log('⚠️  Android project not found (android/app/build.gradle)');
}

console.log('');

// iOS version sync instructions
// Note: iOS versioning is typically managed in Xcode or via xcrun
const iosProjectPath = path.join(__dirname, '../ios');
if (fs.existsSync(iosProjectPath)) {
  console.log('📱 iOS Version Update');
  console.log('---------------------');
  console.log('To update iOS version, use Xcode or run:');
  console.log('');
  console.log(`  cd ios/App`);
  console.log(`  xcrun agvtool new-marketing-version ${version}`);
  console.log(`  xcrun agvtool new-version -all ${versionCode}`);
  console.log('');
  console.log('Or set in Xcode:');
  console.log(`  MARKETING_VERSION = ${version}`);
  console.log(`  CURRENT_PROJECT_VERSION = ${versionCode}`);
} else {
  console.log('⚠️  iOS project not found (ios/)');
}

console.log('');
console.log('✨ Version sync complete!');
console.log('');
