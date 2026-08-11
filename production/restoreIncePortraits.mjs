// Instantly restores Ince's 4 VN portraits to the approved, locked version
// if anyone (accidentally or otherwise) overwrites them.
//
// Backstory: the originals were swapped out for different art in commit
// f25e4da ("Update Ince portrait art"). This script's source of truth is
// NOT that history - it's the `ince-portraits-golden` git tag, created
// specifically to anchor the approved version independent of whatever
// happens on main afterwards. Moving the tag is how a future *intentional*
// art change gets approved; nothing else should move it.
//
// Run: node production/restoreIncePortraits.mjs
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const TAG = 'ince-portraits-golden'
const FILES = ['ince_neutral', 'ince_cheerful', 'ince_delighted', 'ince_curious']
const PORTRAIT_DIR = 'public/assets/packs/Ince/portraits'

let restored = 0
for (const name of FILES) {
  const relPath = `${PORTRAIT_DIR}/${name}.png`
  let blob
  try {
    blob = execFileSync('git', ['show', `${TAG}:${relPath}`], { cwd: ROOT, maxBuffer: 1024 * 1024 * 50 })
  } catch {
    console.error(`FAILED: no ${relPath} at tag ${TAG} - is the tag missing? (git fetch --tags)`)
    process.exitCode = 1
    continue
  }
  writeFileSync(path.join(ROOT, relPath), blob)
  console.log(`restored ${relPath}`)
  restored += 1
}

console.log(restored === FILES.length
  ? `\nAll ${restored} Ince portraits restored to ${TAG}. Review with 'git diff', then commit.`
  : `\nOnly ${restored}/${FILES.length} restored - see errors above.`)
