import { env } from "@/lib/env";

const GITHUB_REST_API = "https://api.github.com";
const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "github-compare-app",
  };

  if (env.GITHUB_ACCESS_TOKEN) {
    Object.assign(headers, {
      Authorization: `Bearer ${env.GITHUB_ACCESS_TOKEN}`,
    });
  }

  if (extra) {
    Object.assign(headers, extra);
  }

  return headers;
}

export async function githubRestFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${GITHUB_REST_API}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      payload?.message ?? `GitHub REST API error (${response.status})`,
      response.status,
      payload,
    );
  }

  return response.json() as Promise<T>;
}

type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function githubGraphqlFetch<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  if (!env.GITHUB_ACCESS_TOKEN) {
    return null;
  }

  const response = await fetch(GITHUB_GRAPHQL_API, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as GraphQlResponse<T>;

  if (!response.ok || payload.errors?.length) {
    throw new GitHubApiError(
      payload.errors?.[0]?.message ??
        `GitHub GraphQL API error (${response.status})`,
      response.status,
      payload,
    );
  }

  return payload.data ?? null;
}
