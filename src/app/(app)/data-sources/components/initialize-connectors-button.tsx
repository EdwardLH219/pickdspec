'use client';

/**
 * Initialize Connectors Button
 * 
 * Allows owners to create all default connectors for a tenant.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';

interface InitializeConnectorsButtonProps {
  tenantId: string;
}

export function InitializeConnectorsButton({ tenantId }: InitializeConnectorsButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInitialize = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/portal/connectors/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to initialize connectors');
        return;
      }

      // Refresh the page to show the new connectors
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={handleInitialize} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Setting up...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Set Up Data Sources
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
