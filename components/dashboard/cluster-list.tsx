import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GenerateFixButton } from './generate-fix-button';

async function getClusters() {
  try {
    const { connectToDatabase } = await import('@/lib/db/connection');
    const { Cluster } = await import('@/lib/db/models');

    await connectToDatabase();

    const clusters = await Cluster.find({
      status: { $ne: 'resolved' },
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

const priorityVariants = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
} as const;

const trendIcons = {
  rising: '📈',
  stable: '➡️',
  declining: '📉',
};

export async function ClusterList() {
  const clusters = await getClusters();

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
          <h3 className="mt-4 text-lg font-semibold">No clusters yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingest some feedback and run the analyzer to create clusters.
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
        <Card
          key={cluster._id.toString()}
          className={`card-hover ${cluster.priority === 'critical' ? 'border-red-500/50' : ''}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={priorityVariants[cluster.priority as keyof typeof priorityVariants]}>
                    {cluster.priority}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {trendIcons[cluster.metrics.trend as keyof typeof trendIcons]} {cluster.metrics.trend}
                  </span>
                </div>
                <CardTitle className="text-lg">{cluster.summary.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {cluster.summary.description}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{cluster.aggregate_severity}</div>
                <div className="text-xs text-muted-foreground">severity</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Severity bar */}
              <div className="space-y-1">
                <Progress
                  value={cluster.aggregate_severity}
                  className="h-2"
                  indicatorClassName={
                    cluster.aggregate_severity >= 80 ? 'bg-red-500' :
                      cluster.aggregate_severity >= 60 ? 'bg-orange-500' :
                        cluster.aggregate_severity >= 40 ? 'bg-yellow-500' :
                          'bg-green-500'
                  }
                />
              </div>

              {/* Metrics */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                  <span>{cluster.metrics.total_items} reports</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{cluster.metrics.sources?.join(', ') || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>First seen: {new Date(cluster.metrics.first_seen).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Affected area */}
              {cluster.summary.affected_area && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Affected:</span>
                  <Badge variant="outline">{cluster.summary.affected_area}</Badge>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/clusters/${cluster._id}`}>
                    View Details
                  </Link>
                </Button>
                <GenerateFixButton
                  clusterId={cluster._id.toString()}
                  isCritical={cluster.priority === 'critical'}
                />
                {cluster.generated_fix?.pr_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={cluster.generated_fix.pr_url} target="_blank" rel="noopener noreferrer">
                      View PR
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
