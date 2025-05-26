const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../config/config.template.json');
const configPath = path.join(__dirname, '../config/config.json');

if (!fs.existsSync(configPath)) {
  fs.copyFileSync(templatePath, configPath);
  console.log('✅ Created config.json from template.');
  console.log('ℹ️  Please edit config.json with your Alpaca API credentials and settings');
} else {
  console.log('ℹ️  config.json already exists. No changes made.');
}

// Add to package.json scripts
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.scripts.setup) {
    pkg.scripts.setup = "node scripts/setup";
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    console.log('✅ Added setup script to package.json');
  }
}
