import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from '../components/Modal'
import { Markdown } from '../components/Markdown'
import { BOARD_COLORS, CARD_COLORS, PRIORITIES, priorityMeta, type Board, type Card, type Column, type Profile, type Team } from '../lib/types'
import { initialsOf } from '../lib/urls'

function SortableCard({
  card,
  assignees,
  onOpen,
}: {
  card: Card
  assignees: Profile[]
  onOpen: (c: Card) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: 'card', card } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeft: `4px solid ${card.color || '#d4d4d4'}`,
  }
  const prio = priorityMeta(card.priority)
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={`w-full rounded-lg border border-line bg-surface p-3.5 text-left text-sm transition hover:border-neutral-400 ${
        card.done ? 'opacity-60' : ''
      }`}
      onClick={() => onOpen(card)}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={card.done ? 'font-medium line-through text-mute' : 'font-semibold text-ink'}>
          {card.title}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {prio && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ background: prio.color }}
            >
              {prio.label}
            </span>
          )}
          {card.done && (
            <span className="rounded-md bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mute">
              done
            </span>
          )}
        </div>
      </div>
      {card.due_date && (
        <p className="mt-2 text-xs font-medium text-mute">{card.due_date}</p>
      )}
      {assignees.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {assignees.map((p) => (
            <span
              key={p.id}
              title={p.full_name || p.email}
              className="grid h-6 w-6 place-items-center rounded-full bg-neutral-200 text-[10px] font-bold text-ink"
            >
              {initialsOf(p.full_name || p.email)}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

function SortableColumn({
  column,
  cards,
  assigneesByCard,
  profilesById,
  onAddCard,
  onOpenCard,
  onRename,
  onDelete,
}: {
  column: Column
  cards: Card[]
  assigneesByCard: Record<string, string[]>
  profilesById: Record<string, Profile>
  onAddCard: (columnId: string, title: string) => void
  onOpenCard: (c: Card) => void
  onRename: (columnId: string, title: string) => void
  onDelete: (columnId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const [draft, setDraft] = useState('')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-[300px] shrink-0 flex-col rounded-xl border border-line bg-white p-3"
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-mute/50 hover:text-mute"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <input
          value={column.title}
          onChange={(e) => onRename(column.id, e.target.value)}
          className="w-full bg-transparent font-display text-sm font-semibold outline-none"
        />
        <button
          type="button"
          className="text-xs text-mute hover:text-danger"
          onClick={() => onDelete(column.id)}
        >
          ✕
        </button>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[48px] flex-col gap-2.5">
          {cards.map((c) => (
            <SortableCard
              key={c.id}
              card={c}
              assignees={(assigneesByCard[c.id] || [])
                .map((id) => profilesById[id])
                .filter(Boolean)}
              onOpen={onOpenCard}
            />
          ))}
        </div>
      </SortableContext>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          onAddCard(column.id, draft.trim())
          setDraft('')
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+ Nueva tarjeta"
          className="w-full rounded-lg border border-dashed border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none transition placeholder:text-mute/70 focus:border-neutral-400 focus:bg-neutral-50"
        />
      </form>
    </div>
  )
}

export function BoardPage() {
  const { boardId } = useParams()
  const { profile, isAdmin } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [editCard, setEditCard] = useState<Card | null>(null)
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [assigneesByCard, setAssigneesByCard] = useState<Record<string, string[]>>({})
  const [showDesc, setShowDesc] = useState(false)
  const [showBoardEdit, setShowBoardEdit] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [boardDesc, setBoardDesc] = useState('')
  const [boardColor, setBoardColor] = useState('#525252')
  const [boardTeamId, setBoardTeamId] = useState('')
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardSaving, setBoardSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {}
    for (const p of profiles) map[p.id] = p
    return map
  }, [profiles])

  const cardsByColumn = useMemo(() => {
    const map: Record<string, Card[]> = {}
    for (const col of columns) map[col.id] = []
    for (const card of cards) {
      if (!map[card.column_id]) map[card.column_id] = []
      map[card.column_id].push(card)
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => a.position - b.position)
    }
    return map
  }, [columns, cards])

  async function load() {
    if (!boardId) return
    const [{ data: b }, { data: cols }, { data: prof }, { data: teamRows }] = await Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).maybeSingle(),
      supabase.from('columns').select('*').eq('board_id', boardId).order('position'),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('teams').select('*').order('name'),
    ])
    const colList = (cols as Column[]) || []
    const colIds = colList.map((c) => c.id)
    let cardRows: Card[] = []
    if (colIds.length) {
      const { data } = await supabase
        .from('cards')
        .select('*')
        .in('column_id', colIds)
        .order('position')
      cardRows = (data as Card[]) || []
    }
    const cardIds = cardRows.map((c) => c.id)
    const assigneeMap: Record<string, string[]> = {}
    for (const id of cardIds) assigneeMap[id] = []
    if (cardIds.length) {
      const { data: assigns } = await supabase
        .from('card_assignees')
        .select('card_id, user_id')
        .in('card_id', cardIds)
      for (const row of assigns || []) {
        const r = row as { card_id: string; user_id: string }
        if (!assigneeMap[r.card_id]) assigneeMap[r.card_id] = []
        assigneeMap[r.card_id].push(r.user_id)
      }
    }
    const boardRow = (b as Board) || null
    setBoard(boardRow)
    setBoardName(boardRow?.name || '')
    setBoardDesc(boardRow?.description_md || '')
    setBoardColor(boardRow?.color || '#525252')
    setBoardTeamId(boardRow?.team_id || '')
    setTeams((teamRows as Team[]) || [])
    setColumns(colList)
    setCards(cardRows)
    setProfiles((prof as Profile[]) || [])
    setAssigneesByCard(assigneeMap)
  }

  useEffect(() => {
    void load()
  }, [boardId])

  async function persistColumnOrder(next: Column[]) {
    setColumns(next)
    await Promise.all(
      next.map((c, i) =>
        supabase.from('columns').update({ position: i }).eq('id', c.id),
      ),
    )
  }

  async function persistCards(next: Card[]) {
    setCards(next)
    await Promise.all(
      next.map((c, _i) =>
        supabase
          .from('cards')
          .update({
            column_id: c.column_id,
            position: c.position,
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.id),
      ),
    )
  }

  function onDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === 'card') {
      setActiveCard(e.active.data.current.card as Card)
    }
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const activeType = active.data.current?.type
    const overType = over.data.current?.type
    if (activeType !== 'card') return

    const activeId = String(active.id)
    const overId = String(over.id)

    setCards((prev) => {
      const activeIndex = prev.findIndex((c) => c.id === activeId)
      if (activeIndex < 0) return prev
      const activeItem = prev[activeIndex]
      let overColumnId = activeItem.column_id

      if (overType === 'card') {
        const overCard = prev.find((c) => c.id === overId)
        if (overCard) overColumnId = overCard.column_id
      } else if (overType === 'column') {
        overColumnId = overId
      } else if (columns.some((c) => c.id === overId)) {
        overColumnId = overId
      }

      if (activeItem.column_id === overColumnId) return prev
      const next = [...prev]
      next[activeIndex] = { ...activeItem, column_id: overColumnId }
      return next
    })
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null)
    const { active, over } = e
    if (!over) return

    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      const oldIndex = columns.findIndex((c) => c.id === active.id)
      const newIndex = columns.findIndex((c) => c.id === over.id)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const next = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({
        ...c,
        position: i,
      }))
      await persistColumnOrder(next)
      return
    }

    if (active.data.current?.type === 'card') {
      const activeId = String(active.id)
      let next = [...cards]
      const fromIdx = next.findIndex((c) => c.id === activeId)
      if (fromIdx < 0) return

      let toColumnId = next[fromIdx].column_id
      if (over.data.current?.type === 'card') {
        const overCard = next.find((c) => c.id === over.id)
        if (overCard) toColumnId = overCard.column_id
      } else if (over.data.current?.type === 'column' || columns.some((c) => c.id === over.id)) {
        toColumnId = String(over.id)
      }

      next[fromIdx] = { ...next[fromIdx], column_id: toColumnId }

      // reindex positions per column
      const byCol: Record<string, Card[]> = {}
      for (const col of columns) byCol[col.id] = []
      for (const c of next) {
        if (!byCol[c.column_id]) byCol[c.column_id] = []
        byCol[c.column_id].push(c)
      }

      if (over.data.current?.type === 'card') {
        const list = byCol[toColumnId]
        const oldInCol = list.findIndex((c) => c.id === activeId)
        const newInCol = list.findIndex((c) => c.id === over.id)
        if (oldInCol >= 0 && newInCol >= 0) {
          byCol[toColumnId] = arrayMove(list, oldInCol, newInCol)
        }
      }

      const flat: Card[] = []
      for (const col of columns) {
        ;(byCol[col.id] || []).forEach((c, i) => {
          flat.push({ ...c, position: i })
        })
      }
      await persistCards(flat)
    }
  }

  async function addColumn() {
    if (!boardId) return
    const { data } = await supabase
      .from('columns')
      .insert({
        board_id: boardId,
        title: 'Nueva lista',
        position: columns.length,
      })
      .select('*')
      .single()
    if (data) setColumns((prev) => [...prev, data as Column])
  }

  async function renameColumn(id: string, title: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
    await supabase.from('columns').update({ title }).eq('id', id)
  }

  async function deleteColumn(id: string) {
    if (!confirm('¿Eliminar columna y sus tarjetas?')) return
    await supabase.from('columns').delete().eq('id', id)
    setColumns((prev) => prev.filter((c) => c.id !== id))
    setCards((prev) => prev.filter((c) => c.column_id !== id))
  }

  async function addCard(columnId: string, title: string) {
    const pos = (cardsByColumn[columnId] || []).length
    const { data } = await supabase
      .from('cards')
      .insert({
        column_id: columnId,
        title,
        position: pos,
        created_by: profile?.id,
      })
      .select('*')
      .single()
    if (data) setCards((prev) => [...prev, data as Card])
  }

  async function saveCard(e: FormEvent) {
    e.preventDefault()
    if (!editCard) return
    const { data } = await supabase
      .from('cards')
      .update({
        title: editCard.title,
        description_md: editCard.description_md,
        color: editCard.color,
        priority: editCard.priority,
        due_date: editCard.due_date,
        done: editCard.done,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editCard.id)
      .select('*')
      .single()
    if (data) {
      setCards((prev) => prev.map((c) => (c.id === editCard.id ? (data as Card) : c)))
    }

    await supabase.from('card_assignees').delete().eq('card_id', editCard.id)
    if (editAssigneeIds.length) {
      await supabase.from('card_assignees').insert(
        editAssigneeIds.map((user_id) => ({
          card_id: editCard.id,
          user_id,
        })),
      )
    }
    setAssigneesByCard((prev) => ({ ...prev, [editCard.id]: [...editAssigneeIds] }))
    setEditCard(null)
    setEditAssigneeIds([])
  }

  async function deleteCard() {
    if (!editCard) return
    await supabase.from('cards').delete().eq('id', editCard.id)
    setCards((prev) => prev.filter((c) => c.id !== editCard.id))
    setAssigneesByCard((prev) => {
      const next = { ...prev }
      delete next[editCard.id]
      return next
    })
    setEditCard(null)
    setEditAssigneeIds([])
  }

  function openCard(card: Card) {
    setEditCard(card)
    setEditAssigneeIds([...(assigneesByCard[card.id] || [])])
  }

  function toggleAssignee(userId: string) {
    setEditAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  async function saveBoardEdit(e: FormEvent) {
    e.preventDefault()
    if (!boardId || !isAdmin) return
    setBoardError(null)
    setBoardSaving(true)
    try {
      const { data, error } = await supabase
        .from('boards')
        .update({
          name: boardName.trim(),
          description_md: boardDesc,
          color: boardColor,
          team_id: boardTeamId || null,
        })
        .eq('id', boardId)
        .select('*')
        .single()
      if (error) {
        setBoardError(error.message)
        return
      }
      setBoard(data as Board)
      setShowBoardEdit(false)
    } finally {
      setBoardSaving(false)
    }
  }

  function openBoardEdit() {
    if (!board || !isAdmin) return
    setBoardName(board.name)
    setBoardDesc(board.description_md || '')
    setBoardColor(board.color || '#525252')
    setBoardTeamId(board.team_id || '')
    setBoardError(null)
    setShowBoardEdit(true)
  }

  if (!board) {
    return (
      <div>
        <Link to="/" className="text-sm font-semibold text-ink">
          ← Tableros
        </Link>
        <p className="mt-4 text-mute">Cargando tablero…</p>
      </div>
    )
  }

  return (
    <div className="-mx-4 space-y-4 sm:-mx-6">
      <div className="board-stage border-y border-line/60 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="text-sm font-semibold text-ink hover:underline">
              ← Tableros
            </Link>
            <h1
              className="mt-1 font-display text-4xl font-semibold"
              style={{ color: board.color }}
            >
              {board.name}
            </h1>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowDesc(true)} className="btn-ghost">
              Descripción
            </button>
            {isAdmin && (
              <button type="button" onClick={openBoardEdit} className="btn-ghost">
                Editar tablero
              </button>
            )}
            <button type="button" onClick={() => void addColumn()} className="btn-primary">
              + Columna
            </button>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <SortableContext
          items={columns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-4 overflow-x-auto px-4 pb-10 sm:px-6">
            {columns.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                cards={cardsByColumn[col.id] || []}
                assigneesByCard={assigneesByCard}
                profilesById={profilesById}
                onAddCard={(id, title) => void addCard(id, title)}
                onOpenCard={openCard}
                onRename={(id, title) => void renameColumn(id, title)}
                onDelete={(id) => void deleteColumn(id)}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeCard ? (
            <div
              className="w-[300px] rounded-lg border border-neutral-300 bg-surface p-3.5 text-sm font-semibold shadow-lg"
              style={{ borderLeft: `4px solid ${activeCard.color || '#94a3b8'}` }}
            >
              {activeCard.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editCard && (
        <Modal title="Tarjeta" onClose={() => { setEditCard(null); setEditAssigneeIds([]) }} wide>
          <form className="space-y-4" onSubmit={saveCard}>
            <label className="block text-sm font-medium">
              Título
              <input
                value={editCard.title}
                onChange={(e) => setEditCard({ ...editCard, title: e.target.value })}
                className="field"
              />
            </label>
            <label className="block text-sm font-medium">
              Descripción (Markdown)
              <textarea
                rows={5}
                value={editCard.description_md}
                onChange={(e) =>
                  setEditCard({ ...editCard, description_md: e.target.value })
                }
                className="field font-mono text-xs"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Fecha
                <input
                  type="date"
                  value={editCard.due_date || ''}
                  onChange={(e) =>
                    setEditCard({ ...editCard, due_date: e.target.value || null })
                  }
                  className="field"
                />
              </label>
              <label className="block text-sm font-medium">
                Prioridad
                <select
                  value={editCard.priority || ''}
                  onChange={(e) =>
                    setEditCard({
                      ...editCard,
                      priority: (e.target.value || null) as Card['priority'],
                    })
                  }
                  className="field"
                >
                  <option value="">Sin prioridad</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={editCard.done}
                onChange={(e) => setEditCard({ ...editCard, done: e.target.checked })}
              />
              Marcar como done
            </label>
            <div>
              <p className="mb-2 text-sm font-medium">Asignados</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                {profiles.length === 0 && (
                  <p className="px-1 py-2 text-xs text-mute">No hay usuarios todavía.</p>
                )}
                {profiles.map((p) => {
                  const checked = editAssigneeIds.includes(p.id)
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssignee(p.id)}
                      />
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-neutral-200 text-[10px] font-bold">
                        {initialsOf(p.full_name || p.email)}
                      </span>
                      <span>
                        <span className="font-medium">{p.full_name || p.email}</span>
                        {p.full_name && (
                          <span className="ml-1 text-xs text-mute">{p.email}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Color</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditCard({ ...editCard, color: null })}
                  className="h-8 w-8 rounded-lg border border-line bg-surface"
                  title="Sin color"
                />
                {CARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditCard({ ...editCard, color: c })}
                    className={`h-8 w-8 rounded-lg ${
                      editCard.color === c ? 'ring-2 ring-offset-2 ring-ink' : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            {editCard.description_md && (
              <div className="rounded-xl bg-canvas p-3">
                <Markdown source={editCard.description_md} />
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                Guardar
              </button>
              <button type="button" onClick={() => void deleteCard()} className="btn-danger">
                Borrar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBoardEdit && isAdmin && (
        <Modal title="Editar tablero" onClose={() => setShowBoardEdit(false)} wide>
          <form className="space-y-4" onSubmit={saveBoardEdit}>
            <label className="block text-sm font-medium">
              Nombre
              <input
                required
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                className="field"
              />
            </label>
            <label className="block text-sm font-medium">
              Equipo (opcional)
              <select
                value={boardTeamId}
                onChange={(e) => setBoardTeamId(e.target.value)}
                className="field"
              >
                <option value="">Sin equipo</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Color de acento
              <div className="mt-2 flex flex-wrap gap-2">
                {BOARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBoardColor(c)}
                    className={`h-8 w-8 rounded-lg ${
                      boardColor === c ? 'ring-2 ring-offset-2 ring-ink' : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={boardColor}
                onChange={(e) => setBoardColor(e.target.value)}
                className="field !mt-2 !h-12 !cursor-pointer !p-1"
              />
            </label>
            <label className="block text-sm font-medium">
              Descripción (Markdown)
              <textarea
                rows={6}
                value={boardDesc}
                onChange={(e) => setBoardDesc(e.target.value)}
                className="field font-mono text-xs"
              />
            </label>
            {boardError && <p className="text-sm text-danger">{boardError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={boardSaving}>
              {boardSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </Modal>
      )}

      {showDesc && (
        <Modal title="Descripción del tablero" onClose={() => setShowDesc(false)} wide>
          <div className="rounded-xl bg-canvas p-3">
            <Markdown source={board.description_md || '_Sin descripción_'} />
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowDesc(false)
                openBoardEdit()
              }}
              className="btn-primary mt-4 w-full"
            >
              Editar tablero
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}
