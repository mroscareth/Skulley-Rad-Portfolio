#!/usr/bin/env node
// Simple DeepL translation script: reads ES JSON, writes EN JSON preserving keys
import fs from 'fs'
import path from 'path'

const DEEPL_KEY = process.env.DEEPL_API_KEY || ''
const useDeepL = !!DEEPL_KEY

async function translateText(text, targetLang) {
  if (!useDeepL) return text
  try {
    const params = new URLSearchParams()
    params.append('auth_key', DEEPL_KEY)
    params.append('text', text)
    params.append('target_lang', targetLang.toUpperCase())
    // Preserve formatting, don't translate placeholders like {{name}}
    params.append('tag_handling', 'xml')
    const res = await fetch('https://api-free.deepl.com/v2/translate', { method: 'POST', body: params })
    const data = await res.json()
    return (data.translations && data.translations[0] && data.translations[0].text) || text
  } catch (e) {
    return text
  }
}

async function walk(obj, targetLang) {
  if (typeof obj === 'string') return translateText(obj, targetLang)
  if (Array.isArray(obj)) return Promise.all(obj.map((v) => walk(v, targetLang)))
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const k of Object.keys(obj)) out[k] = await walk(obj[k], targetLang)
    return out
  }
  return obj
}

async function main() {
  const esPath = path.resolve('src/locales/es.json')
  const enPath = path.resolve('src/locales/en.json')
  if (!fs.existsSync(esPath)) {
    console.error('Missing src/locales/es.json')
    process.exit(1)
  }
  const es = JSON.parse(fs.readFileSync(esPath, 'utf8'))
  const en = await walk(es, 'EN')
  fs.mkdirSync(path.dirname(enPath), { recursive: true })
  fs.writeFileSync(enPath, JSON.stringify(en, null, 2))
  console.log('Wrote', enPath)
}

main()



