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

export type Card = {
  id: string
  column_id: string
  title: string
  description_md: string
  color: string | null
  due_date: string | null
  done: boolean
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export const CARD_COLORS = [
  '#0f766e',
  '#0369a1',
  '#7c3aed',
  '#c2410c',
  '#be123c',
  '#ca8a04',
  '#15803d',
  '#334155',
] as const
