import { protocol } from 'electron'
import { getSubappUrl } from '../subapp-server'
import { PROTOCOL_LSQAPP } from '../shared/env'

export function registerProtocol() {
  protocol.handle(PROTOCOL_LSQAPP, async (request) => {
    const url = request.url
    const parsed = new URL(url)
    const appName = parsed.hostname
    const route = parsed.pathname.slice(1) || ''
    const redirectUrl = getSubappUrl(appName, `index.html#/${route}`)
    return Response.redirect(redirectUrl, 302)
  })
}
