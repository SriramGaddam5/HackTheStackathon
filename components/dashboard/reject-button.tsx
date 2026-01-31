'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';

interface RejectButtonProps {
    clusterId: string;
}

export function RejectButton({ clusterId }: RejectButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleReject = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/clusters/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [clusterId] }),
            });

            if (!response.ok) throw new Error('Failed to reject issue');

            toast({
                title: 'Issue rejected',
                description: 'The issue has been moved to the Rejected tab',
                variant: 'success',
            });

            router.refresh();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to reject issue',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleReject}
            disabled={loading}
        >
            {loading ? 'Rejecting...' : 'Reject'}
        </Button>
    );
}
