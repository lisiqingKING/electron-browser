import { getHistory, clearAllHistory, deleteRecord } from './manager'

export const historyModule = {
  get: () => getHistory(),
  clear: () => { clearAllHistory(); return true },
  delete: (id: number) => { deleteRecord(id); return true },
}
