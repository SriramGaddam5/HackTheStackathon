import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { connectToDatabase } from '@/lib/db/connection';
import { Cluster, FeedbackItem } from '@/lib/db/models';
import { getSeverityLabel, getSeverityColor } from '@/lib/utils/normalize-severity';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getClusterData(id: string) {
  try {
    await connectToDatabase();
    
    const cluster = await Cluster.findById(id).lean();
    if (!cluster) return null;

    const feedbackItems = await FeedbackItem.find({
      _id: { $in: cluster.feedback_items },
    })
      .sort({ normalized_severity: -1 })
      .limit(100)
      .lean();

    return { cluster, feedbackItems };
  } catch (error) {
    console.error('Error fetching cluster:', error);
    return null;
  }
}

const priorityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const statusLabels = {
  active: { label: 'Active', color: 'bg-blue-500' },
  reviewed: { label: 'Reviewed', color: 'bg-purple-500' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500' },
  resolved: { label: 'Resolved', color: 'bg-green-500' },
  wont_fix: { label: "Won't Fix", color: 'bg-gray-500' },
};

export default async function ClusterDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getClusterData(id);

  if (!data) {
    notFound();
  }

  const { cluster, feedbackItems } = data;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Cluster Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge className={priorityColors[cluster.priority as keyof typeof priorityColors]}>
              {cluster.priority.toUpperCase()}
            </Badge>
            <Badge variant="outline" className={statusLabels[cluster.status as keyof typeof statusLabels]?.color}>
              {statusLabels[cluster.status as keyof typeof statusLabels]?.label}
            </Badge>
            {cluster.summary.affected_area && (
              <Badge variant="outline">{cluster.summary.affected_area}</Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold">{cluster.summary.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{cluster.summary.description}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Severity & Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Severity Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">{cluster.aggregate_severity}</div>
                  <div className="flex-1">
                    <Progress 
                      value={cluster.aggregate_severity} 
                      className="h-3"
                      indicatorClassName={
                        cluster.aggregate_severity >= 80 ? 'bg-red-500' :
                        cluster.aggregate_severity >= 60 ? 'bg-orange-500' :
                        cluster.aggregate_severity >= 40 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }
                    />
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getSeverityLabel(cluster.aggregate_severity)} severity
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-2xl font-semibold">{cluster.metrics.total_items}</div>
                    <div className="text-sm text-muted-foreground">Total Reports</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{cluster.metrics.avg_severity}</div>
                    <div className="text-sm text-muted-foreground">Avg Severity</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{cluster.metrics.max_severity}</div>
                    <div className="text-sm text-muted-foreground">Max Severity</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold capitalize">{cluster.metrics.trend}</div>
                    <div className="text-sm text-muted-foreground">Trend</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Root Cause & Fix */}
            {(cluster.summary.root_cause || cluster.summary.suggested_fix) && (
              <Card>
                <CardHeader>
                  <CardTitle>Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cluster.summary.root_cause && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-1">Root Cause</h4>
                      <p>{cluster.summary.root_cause}</p>
                    </div>
                  )}
                  {cluster.summary.suggested_fix && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-1">Suggested Fix</h4>
                      <p>{cluster.summary.suggested_fix}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Generated Fix */}
            {cluster.generated_fix && (
              <Card className="border-green-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Fix Generated
                  </CardTitle>
                  <CardDescription>
                    Generated on {new Date(cluster.generated_fix.generated_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cluster.generated_fix.pr_url && (
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">Pull Request:</span>
                      <a 
                        href={cluster.generated_fix.pr_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {cluster.generated_fix.pr_url}
                      </a>
                      <Badge variant="outline">{cluster.generated_fix.pr_status}</Badge>
                    </div>
                  )}
                  {cluster.generated_fix.file_path && (
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">Local file:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {cluster.generated_fix.file_path}
                      </code>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Feedback Items */}
            <Card>
              <CardHeader>
                <CardTitle>Related Feedback ({feedbackItems.length})</CardTitle>
                <CardDescription>
                  Individual reports that make up this cluster
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {feedbackItems.map((item) => (
                    <div 
                      key={item._id.toString()} 
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.source}</Badge>
                          <Badge variant="outline">{item.feedback_type}</Badge>
                        </div>
                        <span className={`text-sm font-medium ${getSeverityColor(item.normalized_severity)}`}>
                          {item.normalized_severity}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.content.substring(0, 300)}
                        {item.content.length > 300 && '...'}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" asChild>
                  <Link href={`/api/generate-fix?clusterId=${cluster._id}&createPR=true`}>
                    Generate Fix & Create PR
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/api/generate-fix?clusterId=${cluster._id}`}>
                    Generate Fix (No PR)
                  </Link>
                </Button>
                <Button variant="outline" className="w-full">
                  Mark as Resolved
                </Button>
              </CardContent>
            </Card>

            {/* Info */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sources</span>
                  <span>{cluster.metrics.sources?.join(', ') || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First seen</span>
                  <span>{new Date(cluster.metrics.first_seen).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last seen</span>
                  <span>{new Date(cluster.metrics.last_seen).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alert sent</span>
                  <span>{cluster.alert_sent ? 'Yes' : 'No'}</span>
                </div>
                {cluster.assigned_to && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned to</span>
                    <span>{cluster.assigned_to}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {cluster.tags && cluster.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {cluster.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
