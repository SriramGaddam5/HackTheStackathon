import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ClusterList } from '@/components/dashboard/cluster-list';
import { FeedbackList } from '@/components/dashboard/feedback-list';
import { IngestForm } from '@/components/dashboard/ingest-form';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { RunAnalysisButton } from '@/components/dashboard/run-analysis-button';
import { GenerateAllFixesButton } from '@/components/dashboard/generate-all-fixes-button';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-semibold">Feedback Engine</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <RunAnalysisButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Stats Overview */}
        <Suspense fallback={<StatsCardsSkeleton />}>
          <StatsCards />
        </Suspense>

        {/* Main Content */}
        <div className="mt-8">
          <Tabs defaultValue="clusters" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="clusters">Issue Clusters</TabsTrigger>
                <TabsTrigger value="feedback">Raw Feedback</TabsTrigger>
                <TabsTrigger value="ingest">Ingest New</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="clusters" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Critical Issues</h2>
                  <p className="text-muted-foreground">
                    Clusters of related feedback requiring attention
                  </p>
                </div>
                <GenerateAllFixesButton />
              </div>
              <Suspense fallback={<ClusterListSkeleton />}>
                <ClusterList />
              </Suspense>
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">Raw Feedback</h2>
                <p className="text-muted-foreground">
                  Individual feedback items from all sources
                </p>
              </div>
              <Suspense fallback={<FeedbackListSkeleton />}>
                <FeedbackList />
              </Suspense>
            </TabsContent>

            <TabsContent value="ingest" className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">Ingest New Feedback</h2>
                <p className="text-muted-foreground">
                  Add feedback from URLs or direct text input
                </p>
              </div>
              <IngestForm />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

// Loading skeletons
function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ClusterListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-96 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FeedbackListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
