"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeftRight,
  Github,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Swords,
  Wand2,
} from "lucide-react";
import { z } from "zod";

import type {
  ComparisonMetric,
  ComparisonResult,
  GitHubUserInsights,
} from "@/lib/github/types";
import { comparisonInputSchema } from "@/lib/schemas";
import type { MemeResult } from "@/lib/meme";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ComparisonResponse = {
  comparison: ComparisonResult;
  meme: MemeResult | null;
  cached: boolean;
};

const formSchema = comparisonInputSchema.omit({ refresh: true });
type FormValues = z.infer<typeof formSchema>;

const demoPairs: Array<{ label: string; userA: string; userB: string }> = [
  { label: "Open Source Titans", userA: "torvalds", userB: "gaearon" },
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-US");

const weekFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const chartColors = ["#6366F1", "#22D3EE", "#F97316", "#A855F7", "#0EA5E9"];

function formatNumber(value: number) {
  if (Number.isNaN(value)) return "0";
  if (value >= 1000) {
    return numberFormatter.format(value);
  }
  return integerFormatter.format(Math.round(value * 100) / 100);
}

function buildMetricRatio(metric: ComparisonMetric) {
  const total = metric.userA + metric.userB;
  if (total === 0) {
    return { a: 50, b: 50 };
  }
  return {
    a: Math.min(100, Math.max(0, (metric.userA / total) * 100)),
    b: Math.min(100, Math.max(0, (metric.userB / total) * 100)),
  };
}

function getWinner(metric: ComparisonMetric, userA: string, userB: string) {
  if (metric.direction === "equal") return "Tie";
  return metric.diff > 0 ? userA : userB;
}

function alignWeeklyActivity(
  userA: GitHubUserInsights,
  userB: GitHubUserInsights,
) {
  const map = new Map<
    string,
    { [key: string]: number; weekLabel: string }
  >();

  const push = (login: string, data?: GitHubUserInsights["contributions"]) => {
    if (!data) return;
    for (const week of data.weeklySeries.slice(-20)) {
      const existing = map.get(week.weekStart) ?? {
        weekLabel: weekFormatter.format(new Date(week.weekStart)),
      };
      existing[login] = week.total;
      map.set(week.weekStart, existing);
    }
  };

  push(userA.login, userA.contributions);
  push(userB.login, userB.contributions);

  return Array.from(map.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([, value]) => value);
}

function buildLanguageComparison(
  userA: GitHubUserInsights,
  userB: GitHubUserInsights,
) {
  const map = new Map<
    string,
    { language: string; [key: string]: number; color?: string | null }
  >();

  const push = (login: string, languages: GitHubUserInsights["languages"]) => {
    for (const lang of languages.slice(0, 6)) {
      const existing = map.get(lang.name) ?? {
        language: lang.name,
        color: lang.color,
      };
      existing[login] = lang.percentage;
      map.set(lang.name, existing);
    }
  };

  push(userA.login, userA.languages);
  push(userB.login, userB.languages);

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      [userA.login]: entry[userA.login] ?? 0,
      [userB.login]: entry[userB.login] ?? 0,
    }))
    .sort(
      (a, b) =>
        b[userA.login] +
        b[userB.login] -
        (a[userA.login] + a[userB.login]),
    )
    .slice(0, 6);
}

function initials(value: string) {
  return value
    .split("")
    .filter((char) => /[A-Za-z0-9]/.test(char))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ComparisonExperience() {
  const [selectedDemo, setSelectedDemo] = useState(demoPairs[0]);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userA: selectedDemo.userA,
      userB: selectedDemo.userB,
    },
  });

  const mutation = useMutation<ComparisonResponse, Error, z.infer<typeof comparisonInputSchema>>({
    mutationFn: async (payload) => {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error ?? "We couldn't complete the comparison. Try again shortly.",
        );
      }

      return data as ComparisonResponse;
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate(values);
  });

  const handleSwap = () => {
    const { userA, userB } = form.getValues();
    form.setValue("userA", userB);
    form.setValue("userB", userA);
    form.trigger();
  };

  const handleDemoSelect = (pair: (typeof demoPairs)[number]) => {
    setSelectedDemo(pair);
    form.setValue("userA", pair.userA);
    form.setValue("userB", pair.userB);
    form.clearErrors();
  };

  const handleRefresh = (force = false) => {
    const values = form.getValues();
    if (!values.userA || !values.userB) return;
    mutation.mutate({
      ...values,
      refresh: force,
    });
  };

  const isLoading = mutation.isPending;
  const result = mutation.data;

  return (
    <TooltipProvider>
      <div className="space-y-10">
        <header className="rounded-3xl border border-border bg-card px-6 pb-10 pt-12 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Badge
              variant="outline"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-wide"
            >
              <Sparkles className="h-3.5 w-3.5" />
              GitHub Comparison Playground
            </Badge>
            <ThemeToggle />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Put two GitHub developers against each other.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Explore contributions, repo stats, and language superpowers side-by-side — and
                top it off with a meme-worthy verdict powered by real data.
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleRefresh(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Rematch latest duo
            </Button>
          </div>
        </header>

        <Card className="border border-border/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Enter two GitHub profiles</CardTitle>
            <CardDescription>
              Use usernames or paste full profile URLs. We’ll crunch the numbers and deliver the banter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={onSubmit}
                className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-end"
              >
                <FormField
                  control={form.control}
                  name="userA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Challenger A
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. torvalds or https://github.com/torvalds"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-center lg:pb-7">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSwap}
                    className="mt-7 inline-flex items-center gap-2"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Swap
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="userB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 font-medium">
                        <Wand2 className="h-4 w-4 text-primary" />
                        Challenger B
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. gaearon or https://github.com/gaearon"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="lg:col-span-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Try a legendary matchup:
                    </span>
                    {demoPairs.map((pair) => (
                      <Button
                        key={pair.label}
                        type="button"
                        size="sm"
                        variant={
                          selectedDemo.label === pair.label ? "default" : "outline"
                        }
                        onClick={() => handleDemoSelect(pair)}
                      >
                        {pair.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-3 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground">
                    Tip: We cache results for a few minutes to stay within GitHub&apos;s API limits.
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    className="inline-flex items-center gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <Swords className="h-4 w-4" />
                        Compare Profiles
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {mutation.isError && (
          <Alert variant="destructive">
            <AlertTitle>We hit a snag</AlertTitle>
            <AlertDescription>
              {mutation.error.message}
            </AlertDescription>
          </Alert>
        )}

        {isLoading && <LoadingSkeleton />}

        {result && (
          <ComparisonResultPanel
            result={result.comparison}
            meme={result.meme}
            cached={result.cached}
            isRefreshing={isLoading}
            onRefresh={() => handleRefresh(true)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-3">
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type ResultPanelProps = {
  result: ComparisonResult;
  meme: MemeResult | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  cached: boolean;
};

function ComparisonResultPanel({
  result,
  meme,
  onRefresh,
  isRefreshing,
  cached,
}: ResultPanelProps) {
  const { userA, userB, metrics, heroMetric } = result;

  const contributions = useMemo(
    () => alignWeeklyActivity(userA, userB),
    [userA, userB],
  );

  const languages = useMemo(
    () => buildLanguageComparison(userA, userB),
    [userA, userB],
  );

  const metricChartData = useMemo(
    () =>
      metrics.map((metric) => ({
        metric: metric.label,
        [userA.login]: metric.userA,
        [userB.login]: metric.userB,
      })),
    [metrics, userA.login, userB.login],
  );

  const createdSinceA = monthYearFormatter.format(new Date(userA.createdAt));
  const createdSinceB = monthYearFormatter.format(new Date(userB.createdAt));

  return (
    <div className="space-y-6">
      <Card className="border border-border/70">
        <CardHeader className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-xl">
              <Swords className="h-5 w-5 text-primary" />
              {userA.login} vs {userB.login}
              {cached && (
                <Badge variant="outline" className="text-xs">
                  Cached snapshot
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-base">
              {result.summary}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh from GitHub
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <UserHeadline user={userA} heroMetric={heroMetric} />
            <UserHeadline user={userB} heroMetric={heroMetric} reverse />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Key metrics</CardTitle>
            <CardDescription>
              Direct comparison of the numbers that matter most.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {metrics.map((metric) => {
                const ratio = buildMetricRatio(metric);
                const leader = getWinner(metric, userA.login, userB.login);
                return (
                  <div
                    key={metric.id}
                    className="rounded-xl border border-dashed border-border/60 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {metric.label}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {leader}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {metric.description}
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                          {userA.login}
                        </span>
                        <span className="font-semibold">
                          {formatNumber(metric.userA)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
                          {userB.login}
                        </span>
                        <span className="font-semibold">
                          {formatNumber(metric.userB)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Progress value={ratio.a} className="h-2" />
                        <Progress
                          value={ratio.b}
                          className="h-2 bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={metricChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Legend />
                  <RechartsTooltip cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
                  <Bar dataKey={userA.login} fill="#6366F1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey={userB.login} fill="#22D3EE" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col border border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Meme verdict</CardTitle>
            <CardDescription>
              Automatically generated based on the strongest stat gap.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-5">
            {meme?.url ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-lg">
                <Image
                  src={meme.url}
                  alt="Generated meme"
                  fill
                  sizes="(min-width: 1280px) 420px, (min-width: 1024px) 360px, 100vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-dashed border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
                <p>
                  We could not generate a meme this time — double-check the Imgflip credentials in your
                  environment variables if you want maximum banter in production.
                </p>
                {result.memePrompt && (
                  <div className="rounded-lg bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Meme prompt
                    </p>
                    <p className="mt-2 font-medium">
                      {result.memePrompt.topText}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.memePrompt.bottomText}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Template tuned by Imgflip — change credentials or template logic in{" "}
            <code className="rounded bg-muted px-1 py-0.5">src/lib/meme.ts</code>.
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Contribution tempo</CardTitle>
            <CardDescription>
              Weekly contributions over the past {contributions.length} weeks.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer>
              <AreaChart data={contributions}>
                <defs>
                  <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="weekLabel" />
                <YAxis />
                <CartesianGrid strokeDasharray="3 3" />
                <RechartsTooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={userA.login}
                  stroke="#6366F1"
                  fill="url(#colorA)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={userB.login}
                  stroke="#22D3EE"
                  fill="url(#colorB)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">Language dominance</CardTitle>
            <CardDescription>
              Share of the top languages by repository usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <RechartsTooltip />
                  <Pie
                    data={languages}
                    dataKey={userA.login}
                    nameKey="language"
                    innerRadius={20}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {languages.map((entry, index) => (
                      <Cell
                        key={entry.language}
                        fill={entry.color ?? chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 text-sm">
              {languages.map((lang, index) => (
                <div
                  key={lang.language}
                  className="flex items-center justify-between rounded-lg bg-muted/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          lang.color ?? chartColors[index % chartColors.length],
                      }}
                    />
                    <span className="font-medium">{lang.language}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Tooltip>
                      <TooltipTrigger className="text-xs text-muted-foreground">
                        {userA.login}: {formatNumber(lang[userA.login] ?? 0)}%
                      </TooltipTrigger>
                      <TooltipContent>
                        {userA.login} has {formatNumber(lang[userA.login] ?? 0)}% of
                        code in {lang.language}.
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger className="text-xs text-muted-foreground">
                        {userB.login}: {formatNumber(lang[userB.login] ?? 0)}%
                      </TooltipTrigger>
                      <TooltipContent>
                        {userB.login} has {formatNumber(lang[userB.login] ?? 0)}% of
                        code in {lang.language}.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle className="text-lg">Highlights reel</CardTitle>
          <CardDescription>
            Overview of profile tenure and standout repositories.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <RepoHighlights user={userA} createdAtReadable={createdSinceA} />
          <RepoHighlights user={userB} createdAtReadable={createdSinceB} />
        </CardContent>
      </Card>
    </div>
  );
}

type UserHeadlineProps = {
  user: GitHubUserInsights;
  heroMetric: ComparisonResult["heroMetric"];
  reverse?: boolean;
};

function UserHeadline({ user, heroMetric, reverse }: UserHeadlineProps) {
  const topLanguage = user.languages[0];

  return (
    <div
      className={`rounded-2xl border border-dashed border-border/60 p-5 ${reverse ? "text-right" : "text-left"}`}
    >
      <div
        className={`flex items-center gap-4 ${reverse ? "justify-end" : ""}`}
      >
        {!reverse && (
          <Avatar className="h-14 w-14 border border-border/70">
            <AvatarImage src={user.avatarUrl} alt={user.login} />
            <AvatarFallback>{initials(user.login)}</AvatarFallback>
          </Avatar>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{user.login}</h3>
            {heroMetric &&
              ((heroMetric.diff >= 0 && !reverse) ||
                (heroMetric.diff < 0 && reverse)) && (
                <Badge className="bg-primary/90">Top stat flex</Badge>
              )}
          </div>
          {user.name && (
            <p className="text-sm text-muted-foreground">{user.name}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Github className="h-4 w-4" />
            <Link href={user.profileUrl} target="_blank" className="hover:underline">
              View profile
            </Link>
          </div>
        </div>
        {reverse && (
          <Avatar className="h-14 w-14 border border-border/70">
            <AvatarImage src={user.avatarUrl} alt={user.login} />
            <AvatarFallback>{initials(user.login)}</AvatarFallback>
          </Avatar>
        )}
      </div>

      <Separator className="my-4" />

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Followers</dt>
          <dd className="font-semibold">{formatNumber(user.followers)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Public repos</dt>
          <dd className="font-semibold">{formatNumber(user.publicRepos)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Stars earned</dt>
          <dd className="font-semibold">{formatNumber(user.totals.stars)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Weekly avg</dt>
          <dd className="font-semibold">
            {formatNumber(user.contributions?.weeklyAverage ?? 0)}
          </dd>
        </div>
      </dl>

      {topLanguage && (
        <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            Favorite stack: {topLanguage.name}
          </p>
          <p>
            Represents {topLanguage.percentage}% of their tracked repositories.
          </p>
        </div>
      )}
    </div>
  );
}

type RepoHighlightsProps = {
  user: GitHubUserInsights;
  createdAtReadable: string;
};

function RepoHighlights({ user, createdAtReadable }: RepoHighlightsProps) {
  const pinned = user.highlights.pinned ?? [];
  const showcaseCandidates = [
    user.highlights.mostStarred,
    user.highlights.mostForked,
    user.highlights.newestRepo,
    user.highlights.oldestRepo,
  ].filter(Boolean) as typeof user.highlights.mostStarred[];

  const showcase = Array.from(
    new Map(
      showcaseCandidates.map((repo) => [repo.url, repo]),
    ).values(),
  );

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-border/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold">{user.login}</h4>
          <p className="text-xs text-muted-foreground">
            Joined GitHub {createdAtReadable}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {formatNumber(user.totals.issues)} open issues tracked
        </Badge>
      </div>

      <div className="space-y-3">
        {showcase.slice(0, 3).map((repo) => (
          <HighlightRow key={repo.url} repo={repo} />
        ))}
      </div>

      {pinned.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pinned projects
          </p>
          <div className="grid gap-2">
            {pinned.map((repo) => (
              <Link
                key={repo.url}
                href={repo.url}
                target="_blank"
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{repo.name}</span>
                  {repo.primaryLanguage && (
                    <span className="text-xs text-muted-foreground">
                      {repo.primaryLanguage}
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {repo.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type HighlightRowProps = {
  repo: NonNullable<GitHubUserInsights["highlights"]["mostStarred"]>;
};

function HighlightRow({ repo }: HighlightRowProps) {
  return (
    <Link
      href={repo.url}
      target="_blank"
      className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/40"
    >
      <div className="flex flex-1 flex-col">
        <span className="font-medium">{repo.name}</span>
        {repo.description && (
          <span className="text-xs text-muted-foreground line-clamp-1">
            {repo.description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>⭐ {formatNumber(repo.stargazers)}</span>
        <span>🍴 {formatNumber(repo.forks)}</span>
      </div>
    </Link>
  );
}
