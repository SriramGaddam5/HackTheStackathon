import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSeverityLabel, getSeverityColor } from '@/lib/utils/normalize-severity';

async function getFeedback() {
  try {
    const { connectToDatabase } = await import('@/lib/db/connection');
    const { FeedbackItem } = await import('@/lib/db/models');
    
    await connectToDatabase();
    
    const items = await FeedbackItem.find()
      .sort({ normalized_severity: -1, created_at: -1 })
      .limit(50)
      .lean();

    return items;
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return [];
  }
}

const sourceIcons: Record<string, string> = {
  app_store: '🍎',
  product_hunt: '🚀',
  reddit: '🔴',
  quora: 'Q',
  stack_overflow: '📚',
  manual_upload: '📄',
  custom: '🔗',
};

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'critical' | 'high' | 'medium' | 'low';

const typeColors: Record<string, BadgeVariant> = {
  bug: 'destructive',
  feature_request: 'default',
  complaint: 'destructive',
  praise: 'secondary',
  question: 'outline',
  unknown: 'outline',
};

export async function FeedbackList() {
  const items = await getFeedback();

  if (items.length === 0) {
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
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold">No feedback yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start by ingesting feedback from a URL or text input.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item._id.toString()} className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Source icon */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                {sourceIcons[item.source] || '📝'}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={typeColors[item.feedback_type] || 'outline'}>
                    {item.feedback_type || 'unknown'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {item.source}
                  </Badge>
                  <span className={`text-sm font-medium ${getSeverityColor(item.normalized_severity)}`}>
                    {getSeverityLabel(item.normalized_severity)} ({item.normalized_severity})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.content_preview || item.content.substring(0, 200)}
                </p>
                {item.keywords && item.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.keywords.slice(0, 5).map((keyword, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Severity indicator */}
              <div 
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold ${
                  item.normalized_severity >= 80 ? 'bg-red-500/10 text-red-500' :
                  item.normalized_severity >= 60 ? 'bg-orange-500/10 text-orange-500' :
                  item.normalized_severity >= 40 ? 'bg-yellow-500/10 text-yellow-500' :
                  'bg-green-500/10 text-green-500'
                }`}
              >
                {item.normalized_severity}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
