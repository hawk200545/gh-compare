import { TTLCache } from "@/lib/cache";
import {
  GitHubApiError,
  buildHeaders,
  githubGraphqlFetch,
  githubRestFetch,
} from "@/lib/github/client";
import type {
  ComparisonMetric,
  ComparisonResult,
  ContributionStats,
  GitHubUserInsights,
  LanguageStat,
  MemePrompt,
  RepositoryHighlight,
} from "@/lib/github/types";

type RestUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  created_at: string;
};

type RestRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  html_url: string;
  language: string | null;
  archived: boolean;
  disabled: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  private: boolean;
  fork: boolean;
};

type GraphqlRepository = {
  name: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: {
    name: string;
    color: string | null;
  } | null;
  languages: {
    edges: Array<{
      size: number;
      node: {
        name: string;
        color: string | null;
      };
    }>;
  };
  updatedAt: string;
  createdAt: string;
  url: string;
  isArchived: boolean;
};

type GraphqlPinned = {
  name: string;
  description: string | null;
  stargazerCount: number;
  url: string;
  primaryLanguage: { name: string | null } | null;
  updatedAt: string;
  createdAt: string;
  isArchived: boolean;
};

type GraphqlContributionCalendar = {
  contributionCalendar: {
    totalContributions: number;
    weeks: Array<{
      firstDay: string;
      contributionDays: Array<{
        date: string;
        contributionCount: number;
      }>;
    }>;
  };
  totalCommitContributions: number;
  totalIssueContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  restrictedContributionsCount: number;
};

type GraphqlUserAnalytics = {
  user: {
    contributionsCollection: GraphqlContributionCalendar;
    repositories: {
      nodes: GraphqlRepository[];
    };
    pinnedItems: {
      nodes: GraphqlPinned[];
    };
  } | null;
};

const USER_INSIGHTS_CACHE = new TTLCache<GitHubUserInsights>(1000 * 60 * 5);
const COMPARISON_CACHE = new TTLCache<ComparisonResult>(1000 * 60 * 5);

const GRAPHQL_USER_ANALYTICS_QUERY = /* GraphQL */ `
  query UserAnalytics($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays {
              date
              contributionCount
            }
          }
        }
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
      }
      repositories(
        first: 100
        orderBy: { field: STARGAZERS, direction: DESC }
        privacy: PUBLIC
        ownerAffiliations: OWNER
      ) {
        nodes {
          name
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
          updatedAt
          createdAt
          url
          isArchived
        }
      }
      pinnedItems(first: 6, types: [REPOSITORY]) {
        nodes {
          ... on Repository {
            name
            description
            stargazerCount
            url
            primaryLanguage {
              name
            }
            updatedAt
            createdAt
            isArchived
          }
        }
      }
    }
  }
`;

const MEME_TEMPLATES: Record<string, string> = {
  dominant: "61579", // One Does Not Simply
  close: "129242436", // Change My Mind
  upset: "181913649", // Drake Hotline Bling
  tie: "438680", // Batman Slapping Robin
};

const SAFE_METRIC_DIFF_THRESHOLD = 0.01;

function sanitizeLogin(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("GitHub username cannot be empty");
  }

  const urlMatch = trimmed.match(/github\.com\/([^/?#]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  return trimmed.replace(/^@/, "");
}

async function fetchUser(login: string) {
  return githubRestFetch<RestUser>(`/users/${login}`);
}

async function fetchUserRepositories(login: string) {
  const perPage = 100;
  let page = 1;
  const repositories: RestRepo[] = [];

  while (true) {
    const response = await fetch(
      `https://api.github.com/users/${login}/repos?per_page=${perPage}&type=owner&sort=updated&page=${page}`,
      {
        headers: buildHeaders(),
        next: { revalidate: 300 },
      },
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new GitHubApiError(
        errorPayload?.message ??
          `Failed to fetch repositories for ${login} (${response.status})`,
        response.status,
        errorPayload,
      );
    }

    const batch = (await response.json()) as RestRepo[];
    repositories.push(...batch);

    const linkHeader = response.headers.get("link");
    const hasNextPage = linkHeader?.includes(`rel="next"`) ?? false;

    if (!hasNextPage || batch.length < perPage || page >= 3) {
      break;
    }

    page += 1;
  }

  return repositories;
}

async function fetchGraphqlAnalytics(login: string) {
  const data = await githubGraphqlFetch<GraphqlUserAnalytics>(
    GRAPHQL_USER_ANALYTICS_QUERY,
    { login },
  );
  return data?.user ?? null;
}

function aggregateLanguageStats(
  restRepos: RestRepo[],
  gqlRepos: GraphqlRepository[] | undefined,
): LanguageStat[] {
  const languageTotals = new Map<
    string,
    { bytes: number; color?: string | null; repoCount: number }
  >();

  if (gqlRepos?.length) {
    for (const repo of gqlRepos) {
      const seenLanguages = new Set<string>();
      for (const edge of repo.languages.edges) {
        const current = languageTotals.get(edge.node.name) ?? {
          bytes: 0,
          color: edge.node.color,
          repoCount: 0,
        };
        current.bytes += edge.size;
        if (!seenLanguages.has(edge.node.name)) {
          current.repoCount += 1;
          seenLanguages.add(edge.node.name);
        }
        current.color = current.color ?? edge.node.color;
        languageTotals.set(edge.node.name, current);
      }
    }
  } else {
    for (const repo of restRepos) {
      if (!repo.language) continue;
      const current = languageTotals.get(repo.language) ?? {
        bytes: 0,
        color: undefined,
        repoCount: 0,
      };
      current.bytes += 1;
      current.repoCount += 1;
      languageTotals.set(repo.language, current);
    }
  }

  const totalBytes = Array.from(languageTotals.values()).reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  );

  return Array.from(languageTotals.entries())
    .map(([name, entry]) => ({
      name,
      bytes: entry.bytes,
      repoCount: entry.repoCount,
      color: entry.color,
      percentage: totalBytes
        ? Number(((entry.bytes / totalBytes) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 8);
}

function aggregateContributionStats(
  data: GraphqlContributionCalendar | null,
): ContributionStats | undefined {
  if (!data) {
    return undefined;
  }

  const weeks = data.contributionCalendar.weeks;
  const weeklySeries = weeks.map((week) => {
    const total = week.contributionDays.reduce(
      (sum, day) => sum + day.contributionCount,
      0,
    );
    return {
      weekStart: week.firstDay,
      total,
    };
  });

  const weeklyTotals = weeklySeries.map((week) => week.total);
  const weeklyAverage =
    weeklyTotals.length === 0
      ? 0
      : Number(
          (
            weeklyTotals.reduce((sum, count) => sum + count, 0) /
            weeklyTotals.length
          ).toFixed(2),
        );
  const weeklyMax = weeklyTotals.length
    ? Math.max(...weeklyTotals)
    : 0;

  let currentStreak = 0;
  let longestStreak = 0;

  const days = weeks
    .flatMap((week) => week.contributionDays)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const day of days) {
    if (day.contributionCount > 0) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return {
    total: data.contributionCalendar.totalContributions,
    lastYear: weeklyTotals.reduce((sum, count) => sum + count, 0),
    weeklyAverage,
    weeklyMax,
    weeklySeries,
    streak: {
      current: currentStreak,
      longest: longestStreak,
    },
    breakdown: {
      commits: data.totalCommitContributions,
      pullRequests: data.totalPullRequestContributions,
      reviews: data.totalPullRequestReviewContributions,
      issues: data.totalIssueContributions,
      restricted: data.restrictedContributionsCount,
    },
  };
}

function formatRepository(repo: RestRepo): RepositoryHighlight {
  return {
    name: repo.name,
    description: repo.description,
    url: repo.html_url,
    stargazers: repo.stargazers_count,
    forks: repo.forks_count,
    primaryLanguage: repo.language,
    updatedAt: repo.updated_at,
    createdAt: repo.created_at,
    isArchived: repo.archived || repo.disabled,
  };
}

function deriveHighlights(
  repos: RestRepo[],
  pinned: GraphqlPinned[] | undefined,
): GitHubUserInsights["highlights"] {
  const sortedByStars = [...repos].sort(
    (a, b) => b.stargazers_count - a.stargazers_count,
  );
  const sortedByForks = [...repos].sort(
    (a, b) => b.forks_count - a.forks_count,
  );
  const sortedByCreated = [...repos].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const sortedByUpdated = [...repos].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  const mapPinned = (item: GraphqlPinned): RepositoryHighlight => ({
    name: item.name,
    description: item.description,
    url: item.url,
    stargazers: item.stargazerCount,
    forks: 0,
    primaryLanguage: item.primaryLanguage?.name,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
    isArchived: item.isArchived,
  });

  return {
    mostStarred: sortedByStars[0]
      ? formatRepository(sortedByStars[0])
      : undefined,
    mostForked: sortedByForks[0]
      ? formatRepository(sortedByForks[0])
      : undefined,
    oldestRepo: sortedByCreated[0]
      ? formatRepository(sortedByCreated[0])
      : undefined,
    newestRepo: sortedByUpdated[0]
      ? formatRepository(sortedByUpdated[0])
      : undefined,
    pinned: pinned?.map(mapPinned),
  };
}

function computeTotals(repos: RestRepo[]) {
  return repos.reduce(
    (acc, repo) => {
      acc.stars += repo.stargazers_count;
      acc.forks += repo.forks_count;
      acc.watchers += repo.watchers_count;
      acc.issues += repo.open_issues_count;
      return acc;
    },
    { stars: 0, forks: 0, watchers: 0, issues: 0 },
  );
}

function buildMetric(
  id: string,
  label: string,
  userA: number,
  userB: number,
  description?: string,
): ComparisonMetric {
  const diff = Number((userA - userB).toFixed(2));
  const direction =
    Math.abs(diff) <= SAFE_METRIC_DIFF_THRESHOLD
      ? "equal"
      : diff > 0
        ? "up"
        : "down";

  return {
    id,
    label,
    userA,
    userB,
    diff,
    direction,
    description,
  };
}

function buildComparisonMetrics(
  userA: GitHubUserInsights,
  userB: GitHubUserInsights,
): ComparisonMetric[] {
  const aContrib = userA.contributions;
  const bContrib = userB.contributions;

  const aTopLanguage = userA.languages[0];
  const bTopLanguage = userB.languages[0];

  return [
    buildMetric(
      "repositories",
      "Public Repositories",
      userA.publicRepos,
      userB.publicRepos,
      "Total public repositories owned by each user.",
    ),
    buildMetric(
      "stars",
      "Repository Stars",
      userA.totals.stars,
      userB.totals.stars,
      "Sum of stars across public repositories.",
    ),
    buildMetric(
      "followers",
      "Followers",
      userA.followers,
      userB.followers,
      "Follower counts indicate community reach.",
    ),
    buildMetric(
      "weekly_contributions",
      "Average Weekly Contributions",
      aContrib?.weeklyAverage ?? 0,
      bContrib?.weeklyAverage ?? 0,
      "Average contributions per week over the last year.",
    ),
    buildMetric(
      "yearly_contributions",
      "Yearly Contributions",
      aContrib?.lastYear ?? 0,
      bContrib?.lastYear ?? 0,
      "Total contributions in the last 52 weeks.",
    ),
    buildMetric(
      "top_language_share",
      "Top Language Share (%)",
      aTopLanguage?.percentage ?? 0,
      bTopLanguage?.percentage ?? 0,
      "Share of work done in the most used language.",
    ),
    buildMetric(
      "pull_requests",
      "Pull Request Contributions",
      aContrib?.breakdown.pullRequests ?? 0,
      bContrib?.breakdown.pullRequests ?? 0,
      "Pull requests made in the last year.",
    ),
  ];
}

function selectHeroMetric(metrics: ComparisonMetric[]) {
  return (
    metrics
      .filter((metric) => metric.direction !== "equal")
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0] ?? null
  );
}

function buildSummary(result: ComparisonResult) {
  if (!result.heroMetric) {
    return `${result.userA.login} and ${result.userB.login} are neck and neck across all tracked metrics.`;
  }

  const winner =
    result.heroMetric.diff >= 0 ? result.userA.login : result.userB.login;
  const loser =
    result.heroMetric.diff >= 0 ? result.userB.login : result.userA.login;

  return `${winner} outshines ${loser} on ${result.heroMetric.label.toLowerCase()} by ${Math.abs(result.heroMetric.diff)}. Check the charts for the full story.`;
}

function deriveMemePrompt(result: ComparisonResult): MemePrompt | null {
  const { heroMetric } = result;
  if (!heroMetric) {
    return {
      templateId: MEME_TEMPLATES.tie,
      topText: `${result.userA.login} vs ${result.userB.login}`,
      bottomText: "It's too close to call. Maybe open a PR together?",
    };
  }

  const winner =
    heroMetric.diff >= 0 ? result.userA : result.userB;
  const loser = heroMetric.diff >= 0 ? result.userB : result.userA;
  const gap = Math.abs(heroMetric.diff);
  const winnerValue = heroMetric.diff >= 0 ? heroMetric.userA : heroMetric.userB;
  const loserValue = heroMetric.diff >= 0 ? heroMetric.userB : heroMetric.userA;

  const templateId =
    gap > 100 ? MEME_TEMPLATES.dominant : gap < 10 ? MEME_TEMPLATES.close : MEME_TEMPLATES.upset;

  const metricName = heroMetric.label;

  return {
    templateId,
    topText: `${winner.login} flexing ${metricName.toLowerCase()}`,
    bottomText: `${loser.login} stuck on ${loserValue} while ${winner.login} hits ${winnerValue}.`,
  };
}

type FetchOptions = {
  forceRefresh?: boolean;
};

export async function getUserInsights(input: string, options?: FetchOptions) {
  const login = sanitizeLogin(input);
  const cacheKey = login.toLowerCase();

  if (options?.forceRefresh) {
    USER_INSIGHTS_CACHE.clear(cacheKey);
  }

  return USER_INSIGHTS_CACHE.remember(cacheKey, async () => {
    const [user, repos, gql] = await Promise.all([
      fetchUser(login),
      fetchUserRepositories(login),
      fetchGraphqlAnalytics(login),
    ]);

    const totals = computeTotals(repos);

    const insights: GitHubUserInsights = {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      profileUrl: user.html_url,
      bio: user.bio,
      company: user.company,
      location: user.location,
      followers: user.followers,
      following: user.following,
      publicRepos: user.public_repos,
      publicGists: user.public_gists,
      createdAt: user.created_at,
      totals,
      languages: aggregateLanguageStats(
        repos,
        gql?.repositories.nodes,
      ),
      contributions: aggregateContributionStats(
        gql?.contributionsCollection ?? null,
      ),
      highlights: deriveHighlights(repos, gql?.pinnedItems.nodes),
      repositories: repos.map(formatRepository),
    };

    return insights;
  });
}

export async function compareUsers(
  userAInput: string,
  userBInput: string,
  options?: FetchOptions,
) {
  const loginA = sanitizeLogin(userAInput);
  const loginB = sanitizeLogin(userBInput);
  const key = `${loginA.toLowerCase()}::${loginB.toLowerCase()}`;
  if (options?.forceRefresh) {
    COMPARISON_CACHE.clear(key);
  }

  return COMPARISON_CACHE.remember(key, async () => {
    const [userA, userB] = await Promise.all([
      getUserInsights(loginA, options),
      getUserInsights(loginB, options),
    ]);

    const metrics = buildComparisonMetrics(userA, userB);
    const heroMetric = selectHeroMetric(metrics);

    const comparison: ComparisonResult = {
      userA,
      userB,
      metrics,
      heroMetric,
      summary: "",
      memePrompt: null,
    };

    comparison.summary = buildSummary(comparison);
    comparison.memePrompt = deriveMemePrompt(comparison);

    return comparison;
  });
}
