import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClusterCard } from './cluster-card';

async function getClusters() {
  try {
    const { connectToDatabase } = await import('@/lib/db/connection');
    const { Cluster } = await import('@/lib/db/models');

    await connectToDatabase();

    const clusters = await Cluster.find({
      status: { $nin: ['resolved', 'rejected'] },
    })
      .sort({ aggregate_severity: -1 })
      .limit(20)
      .lean();

    return clusters;
  } catch (error) {
    console.error('Error fetching clusters:', error);
    return [];
  }
}

export async function ClusterList() {
  const clustersData = await getClusters();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusters: any[] = JSON.parse(JSON.stringify(clustersData));

  if (clusters.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <svg
            className="h-12 w-12 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold">No critical issues</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Great job! All critical feedback clusters have been resolved or reviewed.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard?tab=ingest">Ingest Feedback</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/api/analyze">Run Analysis</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {clusters.map((cluster) => (
        <ClusterCard
          key={cluster._id.toString()}
          cluster={cluster}
          showReject={true}
        />
      ))}
    </div>
  );
}
