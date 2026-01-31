'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface GenerateFixButtonProps {
    clusterId: string;
    isCritical: boolean;
}

export function GenerateFixButton({ clusterId, isCritical }: GenerateFixButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleGenerateFix = async () => {
        setLoading(true);
        try {
            // 1. Generate Fix Plan
            console.log('Generating fix plan...');

            const response = await fetch('/api/generate-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clusterId, createPR: false }),
            });

            if (!response.ok) throw new Error('Failed to generate fix plan');

            const data = await response.json();

            // 2. Create PR
            console.log('Creating PR...');

            const prResponse = await fetch('/api/generate-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clusterId, createPR: true }),
            });

            if (!prResponse.ok) throw new Error('Failed to create PR');

            const prData = await prResponse.json();
            console.log('PR Response:', prData);

            if (prData.pr_url) {
                if (confirm(`Success! Pull Request created.\n\nClick OK to view it: ${prData.pr_url}`)) {
                    window.open(prData.pr_url, '_blank');
                }
            } else {
                alert('Fix plan generated! (No PR URL returned - check console)');
            }

            // Refresh page to show updated state
            window.location.reload();

        } catch (error) {
            alert('Failed to generate fix. Check console for details.');
            console.error(error);
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
