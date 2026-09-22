/**
 * 基础 UI 原语 —— 按钮、徽章、面板、提示、对话框、toast 等。
 * 约定（AGENTS.md §12）：所有可见文案必须是 Markdown 源字符串，
 * 经 MarkdownInline/markdownInlineNode 渲染；交互控件内 allowLinks={false}。
 */
import { ButtonHTMLAttributes, ReactNode, useEffect, useRef, useState } from 'react';
import { Provenance, PROVENANCE_LABELS } from '../standards/types';
import { Icon, IconName } from './Icon';
import { Tex } from './katex';
import { copyText } from './clipboard';
import { MarkdownBlock, MarkdownInline, MarkdownList, markdownBlockNode, markdownInlineNode } from './Markdown';

/* ---------- 按钮 ---------- */
export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** 可选前置图标（纯装饰，文字标签仍是主体） */
  icon?: IconName;
}

export function Button({ variant = 'default', size = 'md', className = '', type = 'button', icon, children, ...rest }: ButtonProps) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size === 'sm' && 'btn-sm', className]
    .filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 15} />}
      <span className="btn-label">{markdownInlineNode(children, false)}</span>
    </button>
  );
}

/* ---------- 徽章 ---------- */
export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ variant = 'default', children, title }: {
  variant?: BadgeVariant; children: ReactNode; title?: string;
}) {
  return <span className={`badge badge-${variant}`} title={title}>{markdownInlineNode(children)}</span>;
}

export function SourceBadge({ provenance }: { provenance: Provenance }) {
  const variant: BadgeVariant =
    provenance.status === 'source-explicit' ? 'success'
    : provenance.status === 'source-derived' ? 'info'
    : provenance.status === 'general' ? 'default'
    : 'warning';
  const title = [
    PROVENANCE_LABELS[provenance.status],
    provenance.document,
    provenance.section,
    provenance.note,
  ].filter(Boolean).join(' · ');
  return (
    <span className={`badge badge-${variant}`} title={title}>
      <MarkdownInline allowLinks={false}>{PROVENANCE_LABELS[provenance.status]}</MarkdownInline>
    </span>
  );
}

/* ---------- 面板 ---------- */
export function Panel({ title, sub, actions, children, id, className = '', icon, accent = false }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string;
  className?: string; icon?: IconName; accent?: boolean;
}) {
  return (
    <section className={`panel${accent ? ' panel-accent' : ''}${className ? ` ${className}` : ''}`} id={id}>
      {(title || sub || actions) && (
        <div className="panel-head">
          <div className="panel-heading">
            {title && <div className="panel-title">{icon && <Icon name={icon} size={16} />}<span>{markdownInlineNode(title)}</span></div>}
            {sub && <div className="panel-sub">{markdownBlockNode(sub)}</div>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}

/* ---------- 提示 / 公告（全部走 Markdown 渲染，支持公式） ---------- */
export type NoticeVariant = 'info' | 'success' | 'warning' | 'danger';

const NOTICE_ICON: Record<NoticeVariant, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  danger: 'alert',
};

export function Notice({ variant = 'info', title, children, actions, className = '' }: {
  variant?: NoticeVariant; title?: string; children: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <div
      className={`notice notice-${variant}${className ? ` ${className}` : ''}`}
      role={variant === 'warning' || variant === 'danger' ? 'alert' : undefined}
    >
      <div className="n-body">
        {title && (
          <div className="n-title">
            <Icon name={NOTICE_ICON[variant]} />
            <MarkdownInline>{title}</MarkdownInline>
          </div>
        )}
        <div className="n-content">{typeof children === 'string' || typeof children === 'number'
          ? <MarkdownBlock>{children}</MarkdownBlock> : markdownInlineNode(children)}</div>
      </div>
      {actions && <div className="notice-actions">{actions}</div>}
    </div>
  );
}

export function SafetyNotice({ items, compact = false }: { items: string[]; compact?: boolean }) {
  if (items.length === 0) return null;
  if (compact) {
    return (
      <Notice variant="warning" title="安全提示">
        <MarkdownList items={items} />
      </Notice>
    );
  }
  return (
    <div className="safety-banner" role="alert">
      <div className="safety-banner-inner">
        <div className="n-title"><MarkdownInline>安全须知（请先阅读，操作以教师现场要求为准）</MarkdownInline></div>
        <MarkdownList items={items} />
      </div>
    </div>
  );
}

/* ---------- 复制按钮 ---------- */
export function CopyButton({ text, label = '复制', onCopied, size = 'sm' }: {
  text: string | (() => string); label?: string; onCopied?: () => void; size?: 'md' | 'sm';
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      onClick={async () => {
        try {
          await copyText(typeof text === 'function' ? text() : text);
        } catch {
          toast('复制失败：请全选内容后手动复制，或下载文件。');
          return;
        }
        setDone(true);
        onCopied?.();
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? '已复制' : label}
    </Button>
  );
}

/* ---------- 下拉菜单（点击外部/Escape 关闭；菜单项为文字按钮，可带装饰图标） ---------- */
export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export function Menu({ trigger, items, onSelect, size = 'sm', variant = 'default', align = 'right' }: {
  trigger: ReactNode;
  items: MenuItem[];
  onSelect: (id: string) => void;
  size?: 'md' | 'sm';
  variant?: ButtonVariant;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span className="menu-wrap" ref={wrapRef}>
      <Button
        size={size}
        variant={variant}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </Button>
      {open && (
        <span className="menu-pop" role="menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined}>
          {items.map((it) => (
            <button
              key={it.id}
              role="menuitem"
              className="menu-item"
              disabled={it.disabled}
              onClick={() => { setOpen(false); onSelect(it.id); }}
            >
              {it.icon && <Icon name={it.icon} size={15} />}
              <MarkdownInline allowLinks={false}>{it.label}</MarkdownInline>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/* ---------- 对话框 ---------- */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])
      .filter(el => el.getClientRects().length > 0);
    (focusable()[0] ?? dialog.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) { e.preventDefault(); dialog.current?.focus(); }
        else if (e.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} tabIndex={-1} className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="modal-title"><MarkdownInline>{title}</MarkdownInline></span>
          <Button size="sm" variant="ghost" onClick={onClose}>关闭</Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- 空状态 ---------- */
export function EmptyState({ title, hint, icon, children }: { title: string; hint?: string; icon?: IconName; children?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon"><Icon name={icon} size={20} /></div>}
      <div className="empty-title"><MarkdownInline>{title}</MarkdownInline></div>
      {hint && <div className="small muted"><MarkdownBlock>{hint}</MarkdownBlock></div>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

/* ---------- 公式块 ---------- */
export function FormulaBlock({ latex, display = true }: { latex: string; display?: boolean }) {
  return (
    <div className="formula-block">
      <Tex tex={latex} display={display} />
    </div>
  );
}

/* ---------- 标签页 ---------- */
export function Tabs({ tabs, active, onChange, ariaLabel }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === active}
          className={`tab${t.id === active ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <MarkdownInline allowLinks={false}>{t.label}</MarkdownInline>
        </button>
      ))}
    </div>
  );
}

/* ---------- 表单字段 ---------- */
export function Field({ label, hint, error, children }: {
  label?: ReactNode; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="field">
      {label && <div className="field-label">{markdownInlineNode(label)}</div>}
      {children}
      {error && <div className="field-error"><MarkdownBlock>{error}</MarkdownBlock></div>}
      {!error && hint && <div className="field-help"><MarkdownBlock>{hint}</MarkdownBlock></div>}
    </div>
  );
}

/* ---------- toast ---------- */
let toastId = 0;
type Toast = { id: number; text: string };
const toastListeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

export function toast(text: string): void {
  const t = { id: ++toastId, text };
  toasts = [...toasts, t].slice(-3);
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, Math.min(15000, Math.max(5000, text.length * 100)));
}

export function ToastRegion() {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    const l = (t: Toast[]) => setList([...t]);
    toastListeners.add(l);
    return () => { toastListeners.delete(l); };
  }, []);
  return (
    <div className="toast-region" role="status" aria-live="polite" aria-relevant="additions" aria-label="操作反馈">
      {list.map((t) => <div key={t.id} className="toast">
        <div className="toast-content"><MarkdownBlock>{t.text}</MarkdownBlock></div>
        <Button size="sm" variant="ghost" onClick={() => {
          toasts = toasts.filter((item) => item.id !== t.id);
          toastListeners.forEach((listener) => listener(toasts));
        }}>关闭</Button>
      </div>)}
    </div>
  );
}

/* ---------- 二次确认按钮（AGENTS.md §13） ---------- */
export function ConfirmButton({ onConfirm, children, question, variant = 'default', size = 'md', title }: {
  onConfirm: () => void; children: ReactNode; question: string; variant?: ButtonVariant; size?: 'md' | 'sm'; title?: string;
}) {
  const [arm, setArm] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Button
      variant={arm ? 'danger' : variant}
      size={size}
      title={title ?? question}
      onClick={() => {
        if (!arm) {
          setArm(true);
          timer.current = window.setTimeout(() => setArm(false), 3000);
          return;
        }
        window.clearTimeout(timer.current);
        setArm(false);
        onConfirm();
      }}
    >
      {arm ? '再次点击确认' : children}
    </Button>
  );
}
