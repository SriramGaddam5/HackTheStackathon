import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getStats() {
  try {
    const { connectToDatabase } = await import("@/lib/db/connection");
    const { FeedbackItem, Cluster } = await import("@/lib/db/models");

    await connectToDatabase();

    const [totalFeedback, pendingFeedback, totalClusters, criticalClusters] =
      await Promise.all([
        FeedbackItem.countDocuments(),
        FeedbackItem.countDocuments({ status: "pending" }),
        Cluster.countDocuments({
          status: { $nin: ["resolved", "rejected"] },
        }),
        Cluster.countDocuments({
          priority: "critical",
          status: { $nin: ["resolved", "rejected"] },
        }),
      ]);

    // Get average severity
    const severityAgg = await FeedbackItem.aggregate([
      { $group: { _id: null, avgSeverity: { $avg: "$normalized_severity" } } },
    ]);

    return {
      totalFeedback,
      pendingFeedback,
      totalClusters,
      criticalClusters,
      avgSeverity: Math.round(severityAgg[0]?.avgSeverity || 0),
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    // Return zeros on error, not demo data
    return {
      totalFeedback: 0,
      pendingFeedback: 0,
      totalClusters: 0,
      criticalClusters: 0,
      avgSeverity: 0,
      error: true,
    };
  }
}

export async function StatsCards() {
  const stats = await getStats();

  return (
    <div className="space-y-4">
      {"error" in stats && stats.error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-center">
          <p className="text-sm text-red-700 dark:text-red-400">
            <strong>Connection Error:</strong> Could not connect to MongoDB. Check your{" "}
            <code className="rounded bg-red-500/20 px-1">MONGODB_URI</code> in .env.local
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Feedback
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClusters}</div>
            <p className="text-xs text-muted-foreground">
              Grouped issue patterns
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            stats.criticalClusters > 0 ? "border-red-500/50 pulse-critical" : ""
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Critical Issues
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className={`h-4 w-4 ${stats.criticalClusters > 0 ? "text-red-500" : "text-muted-foreground"}`}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${stats.criticalClusters > 0 ? "text-red-500" : ""}`}
            >
              {stats.criticalClusters}
            </div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Severity</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSeverity}</div>
            <p className="text-xs text-muted-foreground">Out of 100</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
