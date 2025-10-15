## GitHub Showdown

GitHub Showdown pits two GitHub profiles against each other with data-rich visuals and a meme-worthy punchline. The app fuses the GitHub REST and GraphQL APIs with React Query, Zod, Recharts, and Shadcn UI to deliver side-by-side analytics, contribution trends, language breakdowns, and an optional Imgflip meme.

### Features

- 🔍 Accepts GitHub usernames or profile URLs with Zod validation
- 📊 Aggregates followers, repository stars, pull requests, and weekly contribution tempo
- 🎨 Responsive Shadcn UI with Recharts-powered visualisations and loading skeletons
- 🧠 Caching layer to stay friendly with GitHub rate limits
- 😂 Meme verdict via Imgflip (optional credentials)

### Getting Started

Install dependencies and spin up the development server:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the following:

```
GITHUB_ACCESS_TOKEN=           # optional but recommended for higher rate limits + GraphQL data
IMGFLIP_USERNAME=              # optional; needed for meme generation
IMGFLIP_PASSWORD=              # optional; needed for meme generation
```

Without a GitHub token you’ll still get basic REST data, but contribution and language analytics will be limited.

### Available Scripts

- `npm run dev` – start Next.js in development mode
- `npm run build` – create a production build
- `npm start` – run the production build locally
- `npm run lint` – lint the codebase with ESLint

### Project Structure

- `src/app/api/compare/route.ts` – API endpoint that fetches GitHub data, aggregates metrics, and triggers meme generation
- `src/lib/github.ts` – orchestrates REST + GraphQL calls, caching, and comparison logic
- `src/components/comparison/` – client-side experience, including the comparison form, charts, and result views
- `src/lib/meme.ts` – wraps the Imgflip API

### Deployment

Deploy to Vercel (recommended) or any platform that supports Next.js 14. Remember to configure the environment variables in your host.
