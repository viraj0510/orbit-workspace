import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, LoaderCircle, X } from 'lucide-react'

export function LoadingScreen({ label = 'Loading workspace…' }) {
  return <div className="loading-screen"><div className="loading-brand"><span className="orbit-mark"><i /><i /><i /></span><strong>orbit<span>.</span></strong></div><div className="loading-indicator"><LoaderCircle size={18} className="spin" /><span>{label}</span></div></div>
}

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>
}

export function Modal({ open, onClose, title, description, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open') }
  }, [open, onClose])

  return <AnimatePresence>{open && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><motion.section className={`modal-card modal-${size}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 14, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 9, scale: .99 }} transition={{ duration: .18 }}><div className="modal-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={17} /></button></div>{children}</motion.section></motion.div>}</AnimatePresence>
}

export function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`status-pill status-${tone}`}><i />{children}</span>
}

export function InlineAlert({ message, tone = 'error' }) {
  if (!message) return null
  const Icon = tone === 'success' ? CheckCircle2 : CircleAlert
  return <div className={`inline-alert alert-${tone}`} role="alert"><Icon size={15} /><span>{message}</span></div>
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={20} /></span><h3>{title}</h3><p>{description}</p>{action}</div>
}
