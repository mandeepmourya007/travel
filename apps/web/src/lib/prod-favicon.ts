import fs from 'node:fs'
import path from 'node:path'

export function readProdFaviconSvg(): string {
  return fs.readFileSync(path.join(process.cwd(), 'public', 'favicon-prod.svg'), 'utf-8')
}
