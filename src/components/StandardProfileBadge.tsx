/** 当前标准配置徽章（点击前往设置切换） */
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../stores/settings';
import { Badge, BadgeVariant } from './ui';

export function StandardProfileBadge({ clickable = true }: {
  clickable?: boolean;
}) {
  const profile = useSettings((s) => s.activeProfile());
  const navigate = useNavigate();
  const variant: BadgeVariant = profile.kind === 'course' ? 'accent' : profile.kind === 'gbt' ? 'info' : 'warning';
  const label = `**标准：**${profile.shortName}${profile.kind === 'custom' ? '（自定义，不代表课程或 GB/T）' : ''}`;
  const el = <Badge variant={variant} title={profile.description}>{label}</Badge>;
  if (!clickable) return el;
  return (
    <button
      className="profile-switch"
      onClick={() => navigate('/settings')}
      title="前往设置切换标准配置"
      aria-label={`当前标准 ${profile.name}，前往设置切换`}
    >
      {el}
    </button>
  );
}
