import { WebContentsView } from 'electron'
import { getTabContext } from '../state'
import { getDomainFromUrl, escapeForJsString, appendCrashTitle } from '../state/coreUtils'
import { env } from '../../shared/env'
import { mainLogger as logger } from '../../shared/logger'

export function registerStabilityHandlers(
  view: WebContentsView,
  tabId: string,
  ctx: ReturnType<typeof getTabContext>,
  safeSend: (channel: string, ...args: any[]) => void
) {
  // 渲染进程崩溃自动恢复
  view.webContents.on('render-process-gone', (_event, details) => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab) return

    logger.warn('[tab] Render process gone:', details.reason, 'tabId:', tabId)

    if (details.reason !== 'clean-exit' && details.reason !== 'killed') {
      tab.info.title = appendCrashTitle(tab.info.title)
      safeSend('tab:info-changed', tab.info)
      view.webContents.reload()
    }
  })

  // 证书错误独立处理，区分于普通网络错误
  view.webContents.on('certificate-error', (_event, url, error, _certificate, _callback) => {
    logger.warn('[tab] Certificate error for URL:', url, 'Error:', error)
    _callback(false)
  })

  // 加载失败处理
  view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return

    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab) return

    logger.error('URL:', validatedURL, 'Error:', errorCode, errorDescription)

    if (tab.info.loadError) {
      const errorUrl = env.getErrorUrl({
        url: tab.info.loadError.url,
        code: tab.info.loadError.code,
        error: tab.info.loadError.message
      })
      view.webContents.executeJavaScript(`location.replace('${escapeForJsString(errorUrl)}')`)
      return
    }

    tab.info.isLoading = false
    tab.info.url = validatedURL
    tab.info.title = getDomainFromUrl(validatedURL) || validatedURL
    tab.info.loadError = {
      url: validatedURL,
      code: errorCode,
      message: errorDescription
    }
    safeSend('tab:loading', { id: tabId, isLoading: false })
    safeSend('tab:info-changed', tab.info)

    const errorUrl = env.getErrorUrl({
      url: validatedURL,
      code: errorCode,
      error: errorDescription
    })

    view.webContents.executeJavaScript(`location.replace('${escapeForJsString(errorUrl)}')`)
  })
}
