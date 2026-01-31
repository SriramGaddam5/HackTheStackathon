'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface IngestResult {
  success: boolean;
  strategy: string;
  source: string;
  items: {
    processed: number;
    saved: number;
    skipped: number;
  };
  errors: string[];
}

export function IngestForm() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [crawl, setCrawl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, crawl }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to ingest');
      }

      setResult(data);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to ingest');
      }

      setResult(data);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="url" className="space-y-4">
        <TabsList>
          <TabsTrigger value="url">URL Scraping</TabsTrigger>
          <TabsTrigger value="text">Direct Text</TabsTrigger>
        </TabsList>

        <TabsContent value="url">
          <Card>
            <CardHeader>
              <CardTitle>Scrape URL</CardTitle>
              <CardDescription>
                Enter a URL from App Store, Product Hunt, Reddit, Quora, or Stack Overflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="https://reddit.com/r/reactjs/comments/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">reddit.com</Badge>
                    <Badge variant="outline" className="text-xs">producthunt.com</Badge>
                    <Badge variant="outline" className="text-xs">apps.apple.com</Badge>
                    <Badge variant="outline" className="text-xs">stackoverflow.com</Badge>
                    <Badge variant="outline" className="text-xs">quora.com</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={crawl}
                      onChange={(e) => setCrawl(e.target.checked)}
                      className="rounded border-input"
                    />
                    Crawl multiple pages (for discussions with many comments)
                  </label>
                </div>

                <Button type="submit" disabled={loading || !url.trim()}>
                  {loading ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Ingesting...
                    </>
                  ) : (
                    'Ingest URL'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text">
          <Card>
            <CardHeader>
              <CardTitle>Direct Text Input</CardTitle>
              <CardDescription>
                Paste feedback text directly (reviews, comments, bug reports)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTextSubmit} className="space-y-4">
                <textarea
                  className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Paste user feedback here...&#10;&#10;Example:&#10;The app keeps crashing when I try to login. This is super frustrating! I've tried reinstalling but nothing works. Please fix this ASAP."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={loading}
                />

                <Button type="submit" disabled={loading || !text.trim()}>
                  {loading ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Ingest Text'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Result display */}
      {result && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-green-700 dark:text-green-400">
                  Successfully ingested feedback
                </h3>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Strategy: <strong>{result.strategy}</strong></span>
                  <span>Source: <strong>{result.source}</strong></span>
                  <span>Processed: <strong>{result.items.processed}</strong></span>
                  <span>Saved: <strong>{result.items.saved}</strong></span>
                  {result.items.skipped > 0 && (
                    <span>Skipped (duplicates): <strong>{result.items.skipped}</strong></span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Run the analyzer to cluster and classify the new feedback.
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <a href="/api/analyze">Run Analysis</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-400">
                  Ingestion failed
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tips for better ingestion</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>For Reddit, use the full URL to a post (e.g., reddit.com/r/subreddit/comments/...)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Enable "Crawl multiple pages" for threads with many comments</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>After ingesting, run the analyzer to classify feedback and create clusters</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Duplicate content is automatically skipped based on content similarity</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
