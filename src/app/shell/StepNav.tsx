/** 工作台步骤导航：桌面渲染在主区左列竖排，≤900px 变为 sticky 横滚条（CSS 驱动） */
import { MarkdownInline } from '../../components/Markdown';

export interface StepNavEntry {
  id: string;
  title: string;
}

export function StepNav({ steps, currentId, onSelect, label = '实验步骤' }: {
  steps: StepNavEntry[];
  currentId: string;
  onSelect: (id: string) => void;
  label?: string;
}) {
  return (
    <nav className="step-nav" aria-label={label}>
      <ol className="step-nav-list">
        {steps.map((step, i) => {
          const active = step.id === currentId;
          return (
            <li key={step.id}>
              <button
                className={`step-item${active ? ' active' : ''}`}
                onClick={() => onSelect(step.id)}
                aria-current={active ? 'step' : undefined}
              >
                <span className="step-num" aria-hidden>{i + 1}</span>
                <span className="step-title"><MarkdownInline allowLinks={false}>{step.title}</MarkdownInline></span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
