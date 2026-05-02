const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'node_modules/node-pty/binding.gyp',
  'node_modules/node-pty/deps/winpty/src/winpty.gyp'
];

filesToPatch.forEach(filePath => {
  const fullPath = path.resolve(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    // Check for both single and double quotes just in case
    const regex = /'SpectreMitigation':\s*'Spectre'|"SpectreMitigation":\s*"Spectre"/g;
    
    if (regex.test(content)) {
      const patchedContent = content.replace(regex, (match) => {
        return match.replace(/'Spectre'/g, "'false'").replace(/"Spectre"/g, '"false"');
      });
      fs.writeFileSync(fullPath, patchedContent, 'utf8');
      console.log(`Patched: ${filePath}`);
    } else {
      console.log(`No SpectreMitigation: Spectre found in ${filePath} (already patched or not present).`);
    }
  } else {
    console.warn(`File not found: ${filePath}`);
  }
});
