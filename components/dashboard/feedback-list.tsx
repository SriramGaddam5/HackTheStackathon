import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSeverityLabel, getSeverityColor } from '@/lib/utils/normalize-severity';

// Demo feedback for when database is not connected
const DEMO_FEEDBACK = [
  {
    _id: 'fb-1',
    source: 'reddit',
    content: "The app keeps crashing whenever I try to log in on my iPhone. I've tried reinstalling but nothing works. This is really frustrating as I need to access my account urgently!",
    content_preview: "The app keeps crashing whenever I try to log in on my iPhone. I've tried reinstalling but nothing works...",
    feedback_type: 'bug',
    normalized_severity: 95,
    keywords: ['crash', 'login', 'iphone', 'reinstall'],
    created_at: new Date('2026-01-30'),
  },
  {
    _id: 'fb-2',
    source: 'app_store',
    content: "Great app overall but the dark mode is terrible. Can barely read any text. Please fix the contrast issues!",
    content_preview: "Great app overall but the dark mode is terrible. Can barely read any text...",
    feedback_type: 'complaint',
    normalized_severity: 78,
    keywords: ['dark mode', 'contrast', 'text', 'readability'],
    created_at: new Date('2026-01-29'),
  },
  {
    _id: 'fb-3',
    source: 'product_hunt',
    content: "Would love to see PDF export functionality. I often need to share reports with clients who don't have access to the platform.",
    content_preview: "Would love to see PDF export functionality. I often need to share reports with clients...",
    feedback_type: 'feature_request',
    normalized_severity: 65,
    keywords: ['pdf', 'export', 'share', 'reports'],
    created_at: new Date('2026-01-28'),
  },
  {
    _id: 'fb-4',
    source: 'quora',
    content: "Is there a way to customize the dashboard layout? I'd like to rearrange the widgets based on what's most important to me.",
    content_preview: "Is there a way to customize the dashboard layout? I'd like to rearrange the widgets...",
    feedback_type: 'question',
    normalized_severity: 45,
    keywords: ['dashboard', 'customize', 'widgets', 'layout'],
    created_at: new Date('2026-01-27'),
  },
  {
    _id: 'fb-5',
    source: 'stack_overflow',
    content: "Getting a 500 error when trying to use the API endpoint /users/profile. The documentation says it should return user data but I'm getting server errors.",
    content_preview: "Getting a 500 error when trying to use the API endpoint /users/profile...",
    feedback_type: 'bug',
    normalized_severity: 88,
    keywords: ['api', 'error', '500', 'profile'],
    created_at: new Date('2026-01-26'),
  },
  {
    _id: 'fb-6',
    source: 'reddit',
    content: "Love the new update! The performance improvements are really noticeable. Keep up the great work team!",
    content_preview: "Love the new update! The performance improvements are really noticeable...",
    feedback_type: 'praise',
    normalized_severity: 15,
    keywords: ['update', 'performance', 'improvements'],
    created_at: new Date('2026-01-25'),
  },
];

async function getFeedback() {
  // Check if MongoDB URI is configured
  if (!process.env.MONGODB_URI) {
    console.log('No MONGODB_URI configured, using demo feedback');
    return DEMO_FEEDBACK;
  }

  try {
    const { connectToDatabase } = await import('@/lib/db/connection');
    const { FeedbackItem } = await import('@/lib/db/models');
    
    await connectToDatabase();
    
    const items = await FeedbackItem.find()
      .sort({ normalized_severity: -1, created_at: -1 })
      .limit(50)
      .lean();

    return items.length > 0 ? items : DEMO_FEEDBACK;
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return DEMO_FEEDBACK;
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

const typeColors: Record<string, string> = {
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
                  <Badge variant={typeColors[item.feedback_type] as keyof typeof typeColors || 'outline'}>
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
