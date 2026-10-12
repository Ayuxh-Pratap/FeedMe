import { open } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const root = process.cwd()
const publicImage = path.join(root, "public", "meta.png")
const openGraphImage = path.join(root, "src", "app", "opengraph-image.png")
const twitterImage = path.join(root, "src", "app", "twitter-image.png")

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f1012"/>
  <rect x="40" y="40" width="1120" height="550" rx="22" fill="#14161b" stroke="#30343d" stroke-width="2"/>

  <rect x="72" y="70" width="52" height="52" rx="14" fill="#087bf0"/>
  <rect x="84" y="82" width="28" height="28" rx="6" fill="none" stroke="#ffffff" stroke-width="3"/>
  <text x="142" y="105" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">FeedMe</text>
  <text x="1078" y="101" fill="#9aa1ad" font-family="Arial, sans-serif" font-size="16" text-anchor="end">Open source</text>

  <text x="74" y="195" fill="#ffffff" font-family="Arial, sans-serif" font-size="50" font-weight="700">Visual feedback, ready to build.</text>
  <text x="74" y="237" fill="#aeb4bf" font-family="Arial, sans-serif" font-size="22">Capture context once. Triage, assign, discuss, and ship with humans or agents.</text>

  <rect x="74" y="290" width="1052" height="245" rx="14" fill="#101216" stroke="#292d35" stroke-width="2"/>
  <rect x="74" y="290" width="208" height="245" rx="14" fill="#0c0e11"/>
  <rect x="94" y="320" width="168" height="38" rx="8" fill="#343a45"/>
  <text x="116" y="345" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="700">Reports</text>
  <text x="108" y="393" fill="#8f96a3" font-family="Arial, sans-serif" font-size="15">My work</text>
  <text x="108" y="430" fill="#8f96a3" font-family="Arial, sans-serif" font-size="15">Team</text>

  <text x="318" y="330" fill="#ffffff" font-family="Arial, sans-serif" font-size="20" font-weight="700">Checkout button overlaps on mobile</text>
  <text x="318" y="360" fill="#959ca8" font-family="Arial, sans-serif" font-size="15">example.com/checkout</text>
  <rect x="318" y="390" width="490" height="92" rx="10" fill="#1b1e24" stroke="#30343d"/>
  <text x="338" y="422" fill="#e4e7ec" font-family="Arial, sans-serif" font-size="15">Captured with screenshot and selected element</text>
  <text x="338" y="452" fill="#959ca8" font-family="Arial, sans-serif" font-size="14">Assigned to Frontend Team</text>

  <rect x="842" y="314" width="250" height="42" rx="9" fill="#20242b"/>
  <circle cx="865" cy="335" r="6" fill="#f2b632"/>
  <text x="880" y="341" fill="#ffffff" font-family="Arial, sans-serif" font-size="15" font-weight="700">High priority</text>
  <rect x="842" y="371" width="250" height="42" rx="9" fill="#20242b"/>
  <circle cx="865" cy="392" r="6" fill="#37c871"/>
  <text x="880" y="398" fill="#ffffff" font-family="Arial, sans-serif" font-size="15" font-weight="700">Ready for review</text>
  <rect x="842" y="428" width="250" height="54" rx="9" fill="#087bf0"/>
  <text x="967" y="462" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="700" text-anchor="middle">Open report</text>

  <text x="74" y="569" fill="#747c89" font-family="Arial, sans-serif" font-size="15">Dashboard + browser capture + MCP developer workflow</text>
</svg>`

const image = await sharp(Buffer.from(svg)).png().toBuffer()

async function replaceImage(filePath) {
  const file = await open(filePath, "r+")

  try {
    await file.write(image, 0, image.length, 0)
    await file.truncate(image.length)
  } finally {
    await file.close()
  }
}

await Promise.all([
  replaceImage(publicImage),
  replaceImage(openGraphImage),
  replaceImage(twitterImage),
])

console.log("Generated FeedMe social images.")
