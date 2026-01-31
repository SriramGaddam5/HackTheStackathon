'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RunAnalysisButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRunAnalysis = async () => {
        setLoading(true);
        try {
            console.log('Starting analysis...');

            const response = await fetch('/api/analyze', {
                method: 'POST',
            });

            const data = await response.json();
            console.log('Analysis result:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            if (data.success) {
                alert(data.success
                    ? `Analysis complete! Classified ${data.items_classified} items into ${data.clusters_created} clusters.`
                    : 'Analysis completed with issues.');

                router.refresh();
            } else {
                throw new Error(data.errors?.[0] || 'Unknown analysis error');
            }

        } catch (error) {
            console.error('Analysis error:', error);
            alert(`Failed to run analysis: ${error instanceof Error ? error.message : 'Check console'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleRunAnalysis}
            disabled={loading}
        >
            {loading ? (
                <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                </>
            ) : (
                'Run Analysis'
            )}
        </Button>
    );
}
