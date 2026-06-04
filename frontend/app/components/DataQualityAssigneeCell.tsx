import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { Avatar } from '~/components/Avatar';
import { TableCellText } from '~/components/TableCellText';
import { useLanguage } from '~/providers/LanguageProvider';

interface DataQualityAssigneeCellProps {
  userId: string | null;
  name: string | null;
  email?: string | null;
  avatarFilename?: string | null;
  onLinkClick?: (e: MouseEvent) => void;
}

export function DataQualityAssigneeCell({
  userId,
  name,
  email,
  avatarFilename,
  onLinkClick,
}: DataQualityAssigneeCellProps) {
  const { t } = useLanguage();

  if (!userId || !name) {
    return <span className="text-muted">{t('assets.unassigned')}</span>;
  }

  const label = email ? `${name} (${email})` : name;

  return (
    <Link
      to={`/admin/users/${userId}`}
      className="flex items-center gap-2 no-underline text-foreground hover:text-primary min-w-0"
      onClick={onLinkClick}
    >
      <Avatar
        userId={userId}
        name={name}
        hasAvatar={avatarFilename}
        size={24}
      />
      <TableCellText value={label} />
    </Link>
  );
}
