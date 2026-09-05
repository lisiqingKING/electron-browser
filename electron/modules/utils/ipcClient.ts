import { getInternalIconFromUrl } from '../../../src/utils/tabIcons'

export function createUtilsProxy() {
  return {
    getInternalIconFromUrl,
  }
}

export type UtilsModule = ReturnType<typeof createUtilsProxy>