import type { ReactNode } from 'react';
import { Badge } from '~/components/Badge';
import { userRoleBadgeClass } from '~/utils/userRole';

interface UserRoleBadgeProps {
  role: string;
  children: ReactNode;
  className?: string;
}

export function UserRoleBadge({ role, children, className = '' }: UserRoleBadgeProps) {
  return <Badge className={`${userRoleBadgeClass(role)} ${className}`.trim()}>{children}</Badge>;
}
