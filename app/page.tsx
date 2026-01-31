import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">
              HackTheStackathon 2026
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              <span className="gradient-text">Feedback-to-Code</span>
              <br />
              Engine
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Automatically ingest user feedback from any source, identify critical issues,
              and generate code fixes with AI-powered PR creation.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/dashboard">
                <Button size="lg" className="gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Open Dashboard
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg">
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The Complete Feedback Loop
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From user complaint to merged PR in minutes, not weeks.
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {/* Step 1 */}
              <Card className="relative card-hover">
                <div className="absolute -top-4 left-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">
                    1
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <CardTitle className="text-lg">Ingest</CardTitle>
                  <CardDescription>
                    Scrape feedback from App Store, Reddit, Product Hunt, and more
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">Firecrawl</Badge>
                    <Badge variant="outline" className="text-xs">Reducto</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2 */}
              <Card className="relative card-hover">
                <div className="absolute -top-4 left-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-sm font-bold text-white">
                    2
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <CardTitle className="text-lg">Analyze</CardTitle>
                  <CardDescription>
                    AI clusters similar issues and calculates severity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">OpenRouter</Badge>
                    <Badge variant="outline" className="text-xs">Claude</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 */}
              <Card className="relative card-hover">
                <div className="absolute -top-4 left-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 text-sm font-bold text-white">
                    3
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <CardTitle className="text-lg">Alert</CardTitle>
                  <CardDescription>
                    Email notifications for critical issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">Resend</Badge>
                    <Badge variant="outline" className="text-xs">Real-time</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Step 4 */}
              <Card className="relative card-hover">
                <div className="absolute -top-4 left-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white">
                    4
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <CardTitle className="text-lg">Generate</CardTitle>
                  <CardDescription>
                    AI creates code fixes and opens PRs automatically
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">GitHub</Badge>
                    <Badge variant="outline" className="text-xs">Auto-PR</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h3 className="text-center text-sm font-semibold text-muted-foreground">
            Built with the modern stack
          </h3>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8 grayscale opacity-70">
            <span className="text-lg font-semibold">Next.js 15</span>
            <span className="text-lg font-semibold">TypeScript</span>
            <span className="text-lg font-semibold">MongoDB</span>
            <span className="text-lg font-semibold">Tailwind</span>
            <span className="text-lg font-semibold">Firecrawl</span>
            <span className="text-lg font-semibold">Resend</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          <p>Built for HackTheStackathon 2026 by YC</p>
        </div>
      </footer>
    </main>
  );
}
