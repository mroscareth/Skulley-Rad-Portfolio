// Enforce Node version compatible with Vite 7 (20.19+ or 22.12+)
const [major, minor] = process.versions.node.split('.').map((v) => parseInt(v, 10))
const isOk =
  major > 22 ||
  (major === 22 && minor >= 12) ||
  major > 20 ||
  (major === 20 && minor >= 19)

if (!isOk) {
  console.error(`\nYou are using Node.js ${process.versions.node}. Vite requires Node.js 20.19+ or 22.12+.\nPlease upgrade your Node.js version.\n`) 
  process.exit(1)
}


