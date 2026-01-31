'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface GenerateFixButtonProps {
    clusterId: string;
    isCritical: boolean;
}

export function GenerateFixButton({ clusterId, isCritical }: GenerateFixButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleGenerateFix = async () => {
        setLoading(true);
        try {
            console.log('Generating fix plan...');

            const response = await fetch('/api/generate-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clusterId, createPR: true }), // Always try to create PR for ease
            });

            const data = await response.json();
            console.log('Fix generation response:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate fix');
            }

            // Check for success or partial success
            if (data.success) {
                if (data.pr_url) {
                    if (confirm(`Success! Pull Request created.\n\nClick OK to view it: ${data.pr_url}`)) {
                        window.open(data.pr_url, '_blank');
                    }
                } else {
                    // Success but no PR URL (maybe simulation or error in PR step caught internally)
                    alert('Fix plan generated!\n(Note: PR creation might have failed or been skipped, check console)');
                }
                // Soft refresh
                router.refresh();
            } else {
                throw new Error(data.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Fix generation error:', error);
            alert(`Error: ${error instanceof Error ? error.message : 'Something went wrong'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            size="sm"
            variant={isCritical ? 'destructive' : 'default'}
            onClick={handleGenerateFix}
            disabled={loading}
        >
            {loading ? (
                <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                </>
            ) : (
                'Generate Fix & PR'
            )}
        </Button>
    );
}
