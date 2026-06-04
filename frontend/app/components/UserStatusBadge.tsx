import type { ReactNode } from 'react';
import { Badge } from '~/components/Badge';
import { userStatusBadgeClass } from '~/utils/userStatus';

interface UserStatusBadgeProps {
  status: string;
  children: ReactNode;
  className?: string;
}

export function UserStatusBadge({ status, children, className = '' }: UserStatusBadgeProps) {
  return <Badge className={`${userStatusBadgeClass(status)} ${className}`.trim()}>{children}</Badge>;
}
