// Regenerates src/voice-licenses.json from the MODEL_CARD of each voice in
// rhasspy/piper-voices. Piper's voices.json carries no licensing information;
// the MODEL_CARD's dataset License line is the only place it is recorded
// (https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/LICENSING.md).
//
// Usage: node web/scripts/update-voice-licenses.mjs
// Review the diff afterwards: cards are free-form, and unrecognized license
// text is reported so OVERRIDES or normalize() can be extended.

import { writeFile } from "node:fs/promises"

const repoUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
const outFile = new URL("../src/voice-licenses.json", import.meta.url)

// Voices whose card can't be read mechanically, or needs a clarification.
const OVERRIDES = {
  "bn_BD-google-medium": "CC BY-SA 4.0",
  "es_MX-ald-x_low": "License not stated",
  "lt_LT-ingute-medium": "NewGenLTU Open RAIL-D 1.0",
  "pl_PL-bass-high": "Apache 2.0",
  "sv_SE-alma-medium": "CC BY 4.0",
  "sv_SE-lisa-medium": "License not stated",
  "ur_PK-aegis_female-medium": "MIT",
  "ur_PK-fasih-medium": "MIT",
  // Cards say "See URL"; licenses read from the dataset pages.
  "en_GB-jenny_dioco-medium": "Jenny (Dioco) license",
  "he_IL-saspeech-medium": "SASPEECH non-commercial license",
  "is_IS-bui-medium": "CC BY 4.0",
  "is_IS-salka-medium": "CC BY 4.0",
  "is_IS-steinn-medium": "CC BY 4.0",
  "is_IS-ugla-medium": "CC BY 4.0",
  "it_IT-paola-medium": "CC0",
}

function normalize(text) {
  const t = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\(.*?\)/g, "").trim().replace(/\/?(deed\.\w+)?$/, "")
  const rules = [
    [/^cc0/i, "CC0"],
    [/^public domain$/i, "Public domain"],
    [/unlicense/i, "Unlicense"],
    [/by-nc-sa\/4\.0|^cc[ -]by-nc-sa 4\.0/i, "CC BY-NC-SA 4.0"],
    [/^cc by-nc-sa 3\.0/i, "CC BY-NC-SA 3.0"],
    [/by-nc\/4\.0|^cc[ -]by-nc[ -]4\.0/i, "CC BY-NC 4.0"],
    [/by-sa\/4\.0|^cc[ -]by-sa[ -]4\.0|^attribution-sharealike 4\.0/i, "CC BY-SA 4.0"],
    [/^cc by-sa 3\.0 es/i, "CC BY-SA 3.0 ES"],
    [/by\/4\.0|^cc[ -]by[ -]4\.0|^creative commons attribution 4\.0/i, "CC BY 4.0"],
    [/by\/3\.0/i, "CC BY 3.0"],
    [/^cc-by$/i, "CC BY"],
    [/^apache[ -]2\.0|LICENSE-2\.0/i, "Apache 2.0"],
    [/^mit$/i, "MIT"],
    [/^gpl 2\.0$/i, "GPL-2.0"],
    [/^agplv3$/i, "AGPL-3.0"],
    [/lessac_blizzard2013/i, "Lessac Blizzard 2013"],
    [/indictts/i, "IIT Madras Indic TTS license"],
    [/^non-commercial use/i, "DataBaker non-commercial license"],
    [/^unknown$/i, "License unknown"],
    [/^see\b/i, "See license"],
  ]
  for (const [re, label] of rules) if (re.test(t)) return label
  return null
}

async function fetchText(path) {
  const res = await fetch(repoUrl + path)
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.text()
}

const voices = JSON.parse(await fetchText("voices.json"))
const result = {}
const problems = []

await Promise.all(Object.values(voices).map(async voice => {
  const cardPath = Object.keys(voice.files).find(x => x.endsWith("/MODEL_CARD"))
  if (!cardPath) return problems.push(`${voice.key}: no MODEL_CARD`)
  const card = await fetchText(cardPath)
  let license = OVERRIDES[voice.key]
  if (!license) {
    const line = card.match(/^\s*[*-]\s*(?:\*\*)?License:?(?:\*\*)?:?\s*(.+)$/im)?.[1]
    license = line ? normalize(line) : null
    if (!license) problems.push(`${voice.key}: unrecognized license ${JSON.stringify(line ?? null)}`)
  }
  result[voice.key] = license ?? "See license"
}))

const sorted = Object.fromEntries(Object.keys(result).sort().map(k => [k, result[k]]))
await writeFile(outFile, JSON.stringify(sorted, null, 2) + "\n")
console.log(`Wrote ${Object.keys(sorted).length} voices to ${outFile.pathname}`)
for (const p of problems) console.warn(p)
