import { Vibrant } from 'node-vibrant/node'
import { ipcLogger } from '../../shared/logger'

export interface ExtractedColor {
  hex: string
  rgb: [number, number, number]
  isLight: boolean
}

export async function extractColorFromBuffer(buffer: Buffer): Promise<ExtractedColor> {
  try {
    const palette = await Vibrant.from(buffer).maxColorCount(4).getPalette()
    const dominant = palette.DominantSwatch || Object.values(palette).find(s => s)!

    if (!dominant) {
      return { hex: '#000000', rgb: [0, 0, 0], isLight: false }
    }

    const hex = dominant.hex
    const rgb = dominant.rgb
    const isLight = isColorLight(rgb)

    ipcLogger.debug('[colorExtractor] extracted:', hex, isLight ? 'light' : 'dark')
    return { hex, rgb, isLight }
  } catch (err) {
    ipcLogger.error('[colorExtractor] failed:', err)
    return { hex: '#000000', rgb: [0, 0, 0], isLight: false }
  }
}

function isColorLight(rgb: [number, number, number]): boolean {
  // 亮度公式：Y = 0.299*R + 0.587*G + 0.114*B
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
  return luminance > 127
}
