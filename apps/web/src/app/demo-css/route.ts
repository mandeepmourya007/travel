import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const filePath = resolve(join(process.cwd(), '../../docs/engineering/fe/preview.html'))
    const html = await readFile(filePath, 'utf-8')
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return new NextResponse('<pre>Error: could not load preview.html</pre>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}
