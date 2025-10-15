import { env } from "@/lib/env";
import type { MemePrompt } from "@/lib/github/types";

type ImgflipResponse = {
  success: boolean;
  data?: {
    url: string;
    page_url: string;
  };
  error_message?: string;
};

export type MemeResult = {
  url: string;
  pageUrl: string;
};

const IMGFLIP_ENDPOINT = "https://api.imgflip.com/caption_image";

export async function generateMeme(
  prompt: MemePrompt | null,
): Promise<MemeResult | null> {
  if (
    !prompt ||
    !env.IMGFLIP_USERNAME ||
    !env.IMGFLIP_PASSWORD ||
    !prompt.templateId
  ) {
    return null;
  }

  const params = new URLSearchParams({
    template_id: prompt.templateId,
    username: env.IMGFLIP_USERNAME,
    password: env.IMGFLIP_PASSWORD,
    text0: prompt.topText,
    text1: prompt.bottomText,
  });

  const response = await fetch(IMGFLIP_ENDPOINT, {
    method: "POST",
    body: params,
  });

  const payload = (await response.json().catch(() => ({}))) as ImgflipResponse;

  if (!response.ok || !payload.success || !payload.data) {
    return null;
  }

  return {
    url: payload.data.url,
    pageUrl: payload.data.page_url,
  };
}
