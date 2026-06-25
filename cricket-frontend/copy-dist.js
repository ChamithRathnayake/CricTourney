import fs from 'fs';
import path from 'path';

const srcDir = './dist';
const destDir = '../cricket-backend/pb_public';

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Clear destination directory if it exists
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}

console.log(`Copying ${srcDir} to ${destDir}...`);
copyRecursiveSync(srcDir, destDir);

// Explicitly copy logo.png from public to pb_public as a fallback if not handled by build tool
const logoSrc = './public/logo.png';
const logoDest = path.join(destDir, 'logo.png');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, logoDest);
  console.log('Explicitly copied logo.png to pb_public');
}

console.log('Copy completed!');
