# Feedback-to-Code Engine

> Universal feedback ingestion, AI-powered clustering, and automatic code fix generation.

Built for [HackTheStackathon 2026](https://events.ycombinator.com/HacktheStackathon) by Y Combinator.

## The Vision

Transform user feedback from scattered sources into actionable code changes—automatically.

```
User Feedback → Ingestion → Analysis → Clustering → Fix Generation → PR Creation
```

## Features

- **Universal Ingestion**: Scrape feedback from App Store, Product Hunt, Reddit, Quora, Stack Overflow, or upload PDFs
- **Intelligent Clustering**: AI groups similar feedback into actionable issue clusters
- **Severity Scoring**: Normalize diverse metrics (stars, upvotes, views) into a unified 0-100 severity score
- **Automatic Alerts**: Email notifications via Resend when critical issues are detected
- **Code Generation**: AI generates fix plans and creates GitHub PRs
- **Beautiful Dashboard**: Real-time view of issues, trends, and fixes

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | MongoDB (Mongoose) |
| Scraping | Firecrawl SDK |
| Document Parsing | Reducto |
| LLM | OpenRouter (Claude 3.5) |
| Email | Resend |
| Styling | Tailwind CSS + Shadcn UI |
| CI/CD | GitHub Actions |

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/feedback-to-code-engine.git
cd feedback-to-code-engine
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```env
MONGODB_URI=mongodb+srv://...
FIRECRAWL_API_KEY=fc-...
REDUCTO_API_KEY=rd-...
OPENROUTER_API_KEY=sk-or-...
RESEND_API_KEY=re_...
ALERT_EMAIL_TO=admin@example.com
GITHUB_TOKEN=ghp_...
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Core Workflow

### 1. Ingest Feedback

**Via Dashboard:**
- Navigate to Dashboard → Ingest New
- Enter a URL or paste text
- Click "Ingest"

**Via API:**
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://reddit.com/r/reactjs/comments/..."}'
```

**Supported Sources:**
- `reddit.com` - Posts and comments
- `producthunt.com` - Product pages and comments
- `apps.apple.com` - App Store reviews
- `stackoverflow.com` - Questions and answers
- `quora.com` - Answers and upvotes
- Any URL (generic parsing)

### 2. Analyze Feedback

Run the Insight Engine to classify and cluster feedback:

```bash
# Via API
curl http://localhost:3000/api/analyze

# Via CLI
npm run analyze
```

This will:
- Classify feedback types (bug, feature_request, complaint, etc.)
- Calculate sentiment scores
- Group similar items into clusters
- Send email alerts for critical clusters (severity > 80)

### 3. Generate Fixes

For a specific cluster:
```bash
curl -X POST http://localhost:3000/api/generate-fix \
  -H "Content-Type: application/json" \
  -d '{"clusterId": "...", "createPR": true}'
```

For all critical clusters:
```bash
# Via API
curl -X POST http://localhost:3000/api/generate-fix \
  -d '{"all": true, "threshold": 80, "createPR": true}'

# Via CLI
npm run generate-fixes
```

## API Reference

### `POST /api/ingest`

Ingest feedback from URLs or text.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to scrape |
| `text` | string | Direct text input |
| `crawl` | boolean | Enable multi-page crawling |
| `maxPages` | number | Max pages to crawl (default: 10) |

### `POST /api/analyze`

Run the Insight Engine.

| Parameter | Type | Description |
|-----------|------|-------------|
| `batchSize` | number | Items to process (default: 50) |
| `skipAlerts` | boolean | Skip email alerts |

### `POST /api/generate-fix`

Generate code fixes.

| Parameter | Type | Description |
|-----------|------|-------------|
| `clusterId` | string | Specific cluster to fix |
| `all` | boolean | Process all critical clusters |
| `threshold` | number | Minimum severity (default: 80) |
| `createPR` | boolean | Create GitHub PR |

### `GET /api/clusters`

Fetch clusters with filtering.

### `GET /api/feedback`

Fetch feedback items with filtering.

## Severity Scoring

The severity normalization system converts diverse metrics into a unified 0-100 score:

| Source | Metric | Mapping |
|--------|--------|---------|
| App Store | 1 star | 95 |
| App Store | 5 stars | 10 |
| Reddit | High score + comments | 35 + log(score) × 8 |
| Product Hunt | Upvotes | 40 + upvotes × 0.8 |
| Stack Overflow | Views + score | 30 + views × 0.005 |

Edit `lib/utils/normalize-severity.ts` to adjust weights.

## GitHub Actions

Automated workflow runs every 6 hours:

1. Ingests from configured sources
2. Analyzes pending feedback
3. Sends alerts for critical issues
4. Optionally generates fixes and creates PRs

Manual trigger available with options:
- `generate_fixes`: Enable fix generation
- `create_prs`: Create GitHub PRs
- `severity_threshold`: Minimum severity to process

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── analyze/          # Analysis endpoint
│   │   ├── clusters/         # Cluster endpoints
│   │   ├── feedback/         # Feedback endpoints
│   │   ├── generate-fix/     # Fix generation endpoint
│   │   └── ingest/           # Ingestion endpoint
│   ├── dashboard/            # Dashboard pages
│   └── page.tsx              # Landing page
├── components/
│   ├── dashboard/            # Dashboard components
│   └── ui/                   # Shadcn UI components
├── lib/
│   ├── coder/                # Agentic Coder service
│   ├── db/                   # MongoDB models & connection
│   ├── ingest/               # Ingestion services
│   ├── intelligence/         # Insight Engine & Resend
│   └── utils/                # Utilities & severity normalization
├── scripts/                  # CLI scripts
└── .github/workflows/        # GitHub Actions
```

## Hackathon Notes

### Key Files to Customize

1. **Severity Weights** (`lib/utils/normalize-severity.ts`)
   - Adjust how different metrics map to severity scores
   - Add new source types

2. **LLM Prompts** (`lib/intelligence/insight-engine.ts`)
   - Customize classification and clustering prompts
   - Adjust the model (default: Claude 3.5 Sonnet)

3. **Email Templates** (`lib/intelligence/resend-client.ts`)
   - Customize alert email design
   - Add new notification types

4. **Fix Generation** (`lib/coder/agentic-coder.ts`)
   - Customize fix plan prompts
   - Add codebase context for better fixes

### Demo Flow

1. Show landing page explaining the concept
2. Navigate to dashboard
3. Ingest from a Reddit thread about your "product"
4. Run analysis to classify and cluster
5. Show severity scoring and clustering
6. Generate a fix for a critical cluster
7. Show the generated markdown and/or PR

## License

MIT

---

Built with love for HackTheStackathon 2026
