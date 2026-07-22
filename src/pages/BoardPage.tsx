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
import { CARD_COLORS, type Board, type Card, type Column } from '../lib/types'

function SortableCard({
  card,
  onOpen,
}: {
  card: Card
  onOpen: (c: Card) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: 'card', card } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeft: `4px solid ${card.color || '#cbd5e1'}`,
  }
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={`w-full rounded-xl bg-white p-3 text-left text-sm shadow-sm ring-1 ring-ink/5 hover:ring-moss/40 ${
        card.done ? 'opacity-70' : ''
      }`}
      onClick={() => onOpen(card)}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={card.done ? 'line-through text-ink/50' : 'font-medium'}>
          {card.title}
        </span>
        {card.done && (
          <span className="rounded bg-moss/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-moss">
            done
          </span>
        )}
      </div>
      {card.due_date && (
        <p className="mt-2 text-xs text-ink/55">📅 {card.due_date}</p>
      )}
    </button>
  )
}

function SortableColumn({
  column,
  cards,
  onAddCard,
  onOpenCard,
  onRename,
  onDelete,
}: {
  column: Column
  cards: Card[]
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
      className="flex w-72 shrink-0 flex-col rounded-2xl bg-ink/[0.04] p-3"
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-ink/30"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <input
          value={column.title}
          onChange={(e) => onRename(column.id, e.target.value)}
          className="w-full bg-transparent font-semibold outline-none"
        />
        <button
          type="button"
          className="text-xs text-coral/70"
          onClick={() => onDelete(column.id)}
        >
          ✕
        </button>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[40px] flex-col gap-2">
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} onOpen={onOpenCard} />
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
          placeholder="+ Añadir tarjeta"
          className="w-full rounded-xl border border-dashed border-ink/20 bg-white/70 px-3 py-2 text-sm outline-none focus:border-moss"
        />
      </form>
    </div>
  )
}

export function BoardPage() {
  const { boardId } = useParams()
  const { profile } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [editCard, setEditCard] = useState<Card | null>(null)
  const [showDesc, setShowDesc] = useState(false)
  const [boardDesc, setBoardDesc] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
    const [{ data: b }, { data: cols }] = await Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).maybeSingle(),
      supabase.from('columns').select('*').eq('board_id', boardId).order('position'),
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
    setBoard((b as Board) || null)
    setBoardDesc((b as Board)?.description_md || '')
    setColumns(colList)
    setCards(cardRows)
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
    setEditCard(null)
  }

  async function deleteCard() {
    if (!editCard) return
    await supabase.from('cards').delete().eq('id', editCard.id)
    setCards((prev) => prev.filter((c) => c.id !== editCard.id))
    setEditCard(null)
  }

  async function saveBoardDesc() {
    if (!boardId) return
    await supabase.from('boards').update({ description_md: boardDesc }).eq('id', boardId)
    setBoard((b) => (b ? { ...b, description_md: boardDesc } : b))
    setShowDesc(false)
  }

  if (!board) {
    return (
      <div>
        <Link to="/" className="text-sm text-moss">
          ← Tableros
        </Link>
        <p className="mt-4 text-ink/50">Cargando tablero…</p>
      </div>
    )
  }

  return (
    <div className="-mx-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <Link to="/" className="text-sm text-moss hover:underline">
            ← Tableros
          </Link>
          <h1 className="font-display text-3xl" style={{ color: board.color }}>
            {board.name}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowDesc(true)}
            className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            Descripción
          </button>
          <button
            type="button"
            onClick={() => void addColumn()}
            className="rounded-xl bg-moss px-3 py-2 text-sm font-semibold text-white"
          >
            + Columna
          </button>
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
          <div className="flex gap-3 overflow-x-auto px-4 pb-8">
            {columns.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                cards={cardsByColumn[col.id] || []}
                onAddCard={(id, title) => void addCard(id, title)}
                onOpenCard={setEditCard}
                onRename={(id, title) => void renameColumn(id, title)}
                onDelete={(id) => void deleteColumn(id)}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeCard ? (
            <div
              className="w-72 rounded-xl bg-white p-3 text-sm shadow-lg"
              style={{ borderLeft: `4px solid ${activeCard.color || '#cbd5e1'}` }}
            >
              {activeCard.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editCard && (
        <Modal title="Tarjeta" onClose={() => setEditCard(null)} wide>
          <form className="space-y-3" onSubmit={saveCard}>
            <label className="block text-sm">
              Título
              <input
                value={editCard.title}
                onChange={(e) => setEditCard({ ...editCard, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Descripción (Markdown)
              <textarea
                rows={5}
                value={editCard.description_md}
                onChange={(e) =>
                  setEditCard({ ...editCard, description_md: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 font-mono text-xs"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Fecha
                <input
                  type="date"
                  value={editCard.due_date || ''}
                  onChange={(e) =>
                    setEditCard({ ...editCard, due_date: e.target.value || null })
                  }
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={editCard.done}
                  onChange={(e) => setEditCard({ ...editCard, done: e.target.checked })}
                />
                Marcar como done
              </label>
            </div>
            <div>
              <p className="mb-2 text-sm">Color</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditCard({ ...editCard, color: null })}
                  className="h-8 w-8 rounded-full border border-ink/20 bg-white"
                  title="Sin color"
                />
                {CARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditCard({ ...editCard, color: c })}
                    className={`h-8 w-8 rounded-full ${
                      editCard.color === c ? 'ring-2 ring-offset-2 ring-ink' : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            {editCard.description_md && (
              <div className="rounded-xl bg-sand p-3">
                <Markdown source={editCard.description_md} />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-moss py-2.5 text-sm font-semibold text-white"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => void deleteCard()}
                className="rounded-xl border border-coral/40 px-4 py-2.5 text-sm text-coral"
              >
                Borrar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDesc && (
        <Modal title="Descripción del tablero" onClose={() => setShowDesc(false)} wide>
          <textarea
            rows={10}
            value={boardDesc}
            onChange={(e) => setBoardDesc(e.target.value)}
            className="w-full rounded-xl border border-ink/15 px-3 py-2 font-mono text-xs"
          />
          <div className="mt-3 rounded-xl bg-sand p-3">
            <Markdown source={boardDesc} />
          </div>
          <button
            type="button"
            onClick={() => void saveBoardDesc()}
            className="mt-3 w-full rounded-xl bg-moss py-2.5 text-sm font-semibold text-white"
          >
            Guardar descripción
          </button>
        </Modal>
      )}
    </div>
  )
}
