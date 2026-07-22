import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-ink/50">Sin descripción.</p>
  }
  return (
    <div className="prose-trufi text-sm text-ink/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  )
}
