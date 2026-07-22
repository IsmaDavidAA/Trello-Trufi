export type Role = 'admin' | 'member'

export type Profile = {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

export type Invite = {
  id: string
  email: string
  full_name: string
  token: string
  role: Role
  used_at: string | null
  created_at: string
}

export type Team = {
  id: string
  name: string
  description_md: string
  created_by: string | null
  created_at: string
}

export type TeamMember = {
  team_id: string
  user_id: string
  role: 'lead' | 'member'
}

export type Board = {
  id: string
  name: string
  description_md: string
  color: string
  team_id: string | null
  created_by: string | null
  position: number
  created_at: string
}

export type Column = {
  id: string
  board_id: string
  title: string
  position: number
  created_at: string
}

export type CardPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Card = {
  id: string
  column_id: string
  title: string
  description_md: string
  color: string | null
  priority: CardPriority | null
  due_date: string | null
  done: boolean
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export const CARD_COLORS = [
  '#171717',
  '#404040',
  '#737373',
  '#525252',
  '#b91c1c',
  '#c2410c',
  '#a16207',
  '#15803d',
  '#0f766e',
  '#1d4ed8',
  '#57534e',
  '#44403c',
] as const

export const BOARD_COLORS = [
  '#171717',
  '#404040',
  '#525252',
  '#b91c1c',
  '#c2410c',
  '#a16207',
  '#15803d',
  '#0f766e',
  '#1d4ed8',
  '#57534e',
] as const

export const PRIORITIES: { value: CardPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baja', color: '#64748b' },
  { value: 'medium', label: 'Media', color: '#1d4ed8' },
  { value: 'high', label: 'Alta', color: '#c2410c' },
  { value: 'urgent', label: 'Urgente', color: '#b91c1c' },
]

export function priorityMeta(priority: CardPriority | null | undefined) {
  if (!priority) return null
  return PRIORITIES.find((p) => p.value === priority) ?? null
}

export function parsePriority(raw: string | null | undefined): CardPriority | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (s === 'low' || s === 'baja' || s === '1') return 'low'
  if (s === 'medium' || s === 'media' || s === 'med' || s === '2') return 'medium'
  if (s === 'high' || s === 'alta' || s === '3') return 'high'
  if (s === 'urgent' || s === 'urgente' || s === '4') return 'urgent'
  return null
}
