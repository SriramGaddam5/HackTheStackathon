'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Assuming button exists
import { ClusterCard } from './cluster-card';
import { useToast } from '@/lib/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

interface RejectedClusterListProps {
    clusters: any[]; // Avoid complex types for now in client component
}

export function RejectedClusterListClient({ clusters }: RejectedClusterListProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleSelect = (id: string, selected: boolean) => {
        if (selected) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        }
    };

    const handleEmpty = async (all: boolean = false) => {
        if (!all && selectedIds.length === 0) return;

        if (!confirm(all ? 'Are you sure you want to permanently delete ALL rejected issues?' : `Are you sure you want to permanently delete ${selectedIds.length} selected issues?`)) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/clusters/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: all ? [] : selectedIds,
                    all
                }),
            });

            if (!response.ok) throw new Error('Failed to delete issues');

            const data = await response.json();

            toast({
                title: 'Issues deleted',
                description: `Permanently deleted ${data.deletedCount} issues.`,
                variant: 'success',
            });

            setSelectedIds([]);
            router.refresh();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete issues',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    if (clusters.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">No rejected issues</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Issues you reject will appear here for review or deletion.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 py-2">
                <Button
                    variant="destructive"
                    size="sm"
                    disabled={loading || selectedIds.length === 0}
                    onClick={() => handleEmpty(false)}
                >
                    Empty Selected ({selectedIds.length})
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={loading}
                    onClick={() => handleEmpty(true)}
                >
                    Empty All
                </Button>

                {selectedIds.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIds([])}
                    >
                        Clear Selection
                    </Button>
                )}
            </div>

            <div className="space-y-4">
                {clusters.map((cluster) => (
                    <ClusterCard
                        key={cluster._id.toString()}
                        cluster={cluster}
                        showReject={false}
                        selectable={true}
                        selected={selectedIds.includes(cluster._id.toString())}
                        onSelect={handleSelect}
                    />
                ))}
            </div>
        </div>
    );
}
