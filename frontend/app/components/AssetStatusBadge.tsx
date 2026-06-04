import type { ReactNode } from 'react';
import { Badge } from '~/components/Badge';
import type { AssetStatus } from '~/types';
import { assetStatusBadgeClass } from '~/utils/assetStatus';

interface AssetStatusBadgeProps {
  status: AssetStatus;
  children: ReactNode;
  className?: string;
}

export function AssetStatusBadge({ status, children, className = '' }: AssetStatusBadgeProps) {
  return <Badge className={`${assetStatusBadgeClass(status)} ${className}`.trim()}>{children}</Badge>;
}
