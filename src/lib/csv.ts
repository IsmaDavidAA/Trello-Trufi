/** CSV helpers (RFC 4180-ish) for export/import */

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ]
  return lines.join('\r\n') + '\r\n'
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const table: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  let inQuotes = false

  while (i < normalized.length) {
    const ch = normalized[i]
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) table.push(row)
      row = []
      i += 1
      continue
    }
    cell += ch
    i += 1
  }

  if (cell.length || row.length) {
    row.push(cell)
    if (row.some((c) => c.trim() !== '')) table.push(row)
  }

  if (!table.length) return { headers: [], rows: [] }

  const headers = table[0].map((h) => h.trim().toLowerCase())
  const rows = table.slice(1).map((cols) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').trim()
    })
    return obj
  })

  return { headers, rows }
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const TASK_CSV_HEADERS = [
  'board',
  'column',
  'title',
  'description_md',
  'color',
  'priority',
  'due_date',
  'done',
  'assignees',
  'team',
] as const

export type TaskCsvRow = {
  board: string
  column: string
  title: string
  description_md: string
  color: string
  priority: string
  due_date: string
  done: string
  assignees: string
  team: string
}
