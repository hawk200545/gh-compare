import { z } from "zod";

const normalizeHandle = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/github\.com\/([^/?#]+)/);
  if (match) {
    return match[1];
  }
  return trimmed.replace(/^@/, "");
};

export const comparisonInputSchema = z
  .object({
    userA: z
      .string()
      .min(1, "First GitHub user is required.")
      .regex(
        /^[A-Za-z0-9\-@._:/?=]+$/,
        "Provide a GitHub username or profile URL.",
      ),
    userB: z
      .string()
      .min(1, "Second GitHub user is required.")
      .regex(
        /^[A-Za-z0-9\-@._:/?=]+$/,
        "Provide a GitHub username or profile URL.",
      ),
    refresh: z.boolean().optional(),
  })
  .refine(
    (data) =>
      normalizeHandle(data.userA) !== normalizeHandle(data.userB),
    {
      message: "Pick two different users to compare.",
      path: ["userB"],
    },
  );

export type ComparisonInput = z.infer<typeof comparisonInputSchema>;
