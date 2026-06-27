const sharp = require('sharp')

const svgBuffer = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg"
     width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#1D9E75"/>
  <circle cx="256" cy="180" r="80" fill="white"/>
  <path d="M256 290 C160 290 100 340 100 420 L412 420
           C412 340 352 290 256 290Z" fill="white"/>
  <path d="M256 480 C256 480 160 380 160 300
           C160 247 203 204 256 204
           C309 204 352 247 352 300
           C352 380 256 480 256 480Z"
        fill="none" stroke="white"
        stroke-width="16" opacity="0.4"/>
</svg>
`)

sharp(svgBuffer).resize(192, 192).png()
  .toFile('icon-192.png')
  .then(() => console.log('Created icon-192.png'))
  .catch(err => console.error('icon-192 error:', err))

sharp(svgBuffer).resize(512, 512).png()
  .toFile('icon-512.png')
  .then(() => console.log('Created icon-512.png'))
  .catch(err => console.error('icon-512 error:', err))
