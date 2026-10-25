export type PublicUser = { id: string; name: string; email: string; avatar?: string }
const TOKEN_KEY = 'kurio-session-token'
const USER_ID_KEY = 'kurio-session-user-id'
const SESSION_CHANGE_EVENT = 'kurio:session-change'

export const sessionToken = () => localStorage.getItem(TOKEN_KEY)
export const sessionUserId = () => localStorage.getItem(USER_ID_KEY)
export const cartQueryKey = () => ['cart', sessionUserId() ?? 'guest'] as const

export const saveSession = (token: string, userId: string) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_ID_KEY, userId)
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT))
}

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_ID_KEY)
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT))
}
