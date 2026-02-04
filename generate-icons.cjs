const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb" rx="64"/>
  <circle cx="256" cy="256" r="160" fill="none" stroke="white" stroke-width="24"/>
  <line x1="256" y1="256" x2="256" y2="156" stroke="white" stroke-width="24" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="336" y2="256" stroke="white" stroke-width="24" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="20" fill="white"/>
</svg>`;

async function generateIcons() {
  const publicDir = path.join(__dirname, 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const size of sizes) {
    const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);
    
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`Generated: icon-${size}x${size}.png`);
  }
  
  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
