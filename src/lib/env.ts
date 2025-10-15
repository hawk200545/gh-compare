import { z } from "zod";

const envSchema = z.object({
  GITHUB_ACCESS_TOKEN: z.string().optional(),
  IMGFLIP_USERNAME: z.string().optional(),
  IMGFLIP_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);
