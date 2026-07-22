/** URL pública de la app (sirve para GitHub Pages + HashRouter). */
export function appOriginBase() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${window.location.origin}${base}`
}

export function inviteUrl(token: string) {
  return `${appOriginBase()}/#/invite/${token}`
}

export function initialsOf(nameOrEmail: string) {
  return nameOrEmail
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
