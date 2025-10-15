export type ContributionDay = {
  date: string;
  contributionCount: number;
};

export type WeeklyContribution = {
  weekStart: string;
  total: number;
};

export type ContributionStats = {
  total: number;
  lastYear: number;
  weeklyAverage: number;
  weeklyMax: number;
  weeklySeries: WeeklyContribution[];
  streak: {
    current: number;
    longest: number;
  };
  breakdown: {
    commits: number;
    pullRequests: number;
    reviews: number;
    issues: number;
    restricted: number;
  };
};

export type LanguageStat = {
  name: string;
  bytes: number;
  percentage: number;
  color?: string | null;
  repoCount: number;
};

export type RepositoryHighlight = {
  name: string;
  description: string | null;
  url: string;
  stargazers: number;
  forks: number;
  primaryLanguage?: string | null;
  updatedAt: string;
  createdAt: string;
  isArchived: boolean;
};

export type GitHubUserInsights = {
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  createdAt: string;
  totals: {
    stars: number;
    forks: number;
    watchers: number;
    issues: number;
  };
  languages: LanguageStat[];
  contributions?: ContributionStats;
  highlights: {
    mostStarred?: RepositoryHighlight;
    mostForked?: RepositoryHighlight;
    newestRepo?: RepositoryHighlight;
    oldestRepo?: RepositoryHighlight;
    pinned?: RepositoryHighlight[];
  };
  repositories: RepositoryHighlight[];
};

export type ComparisonMetric = {
  id: string;
  label: string;
  description?: string;
  userA: number;
  userB: number;
  diff: number;
  direction: "up" | "down" | "equal";
};

export type MemePrompt = {
  templateId: string;
  topText: string;
  bottomText: string;
};

export type ComparisonResult = {
  userA: GitHubUserInsights;
  userB: GitHubUserInsights;
  metrics: ComparisonMetric[];
  heroMetric: ComparisonMetric | null;
  summary: string;
  memePrompt: MemePrompt | null;
};
