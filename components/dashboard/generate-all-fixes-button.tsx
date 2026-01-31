'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function GenerateAllFixesButton() {
    const [loading, setLoading] = useState(false);

    const handleGenerateAll = async () => {
        setLoading(true);
        try {
            console.log('Generating all fixes...');

            const response = await fetch('/api/generate-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true, createPR: true }), // Assuming user wants PRs for all
            });

            if (!response.ok) throw new Error('Failed to generate fixes');

            const data = await response.json();
            console.log('Generation result:', data);

            alert(`Process complete!\nSucceeded: ${data.succeeded}\nFailed: ${data.failed}`);

            window.location.reload();

        } catch (error) {
            console.error('Generation error:', error);
            alert('Failed to generate fixes. Check console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAll}
            disabled={loading}
        >
            {loading ? (
                <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Running...
                </>
            ) : (
                'Generate All Fixes'
            )}
        </Button>
    );
}
