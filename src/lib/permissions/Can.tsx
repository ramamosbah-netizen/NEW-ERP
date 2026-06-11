'use client';

import React from 'react';
import { usePermissions } from './usePermissions';

interface CanProps {
  perform: string;
  creatorId?: string | null;
  assignedId?: string | null;
  creatorDept?: string | null;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  perform,
  creatorId,
  assignedId,
  creatorDept,
  fallback = null,
  children
}) => {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null; // or loading skeleton/spinner
  }

  const allowed = hasPermission(perform, creatorId, assignedId, creatorDept);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default Can;
