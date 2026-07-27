import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

const outDir = 'dist/student'

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const htmlSrc = join(outDir, 'student.html')
const htmlDst = join(outDir, 'index.html')

if (await exists(htmlSrc)) {
  await rename(htmlSrc, htmlDst)
  console.log('renamed student.html → index.html')
}

if (await exists(htmlDst)) {
  await copyFile(htmlDst, join(outDir, '404.html'))
  console.log('created dist/student/404.html')
}

// Student app should not ship ArUco detection assets
for (const name of ['vendor', 'detect.worker.js']) {
  const p = join(outDir, name)
  if (await exists(p)) {
    await rm(p, { recursive: true, force: true })
    console.log(`removed ${p}`)
  }
}

// Ensure push-sw.js is present under student outDir (copied from public by Vite)
const pushSw = join(outDir, 'push-sw.js')
if (!(await exists(pushSw)) && (await exists('public/push-sw.js'))) {
  await copyFile('public/push-sw.js', pushSw)
}

const files = await readdir(outDir).catch(() => [])
console.log('student build files:', files.join(', '))
