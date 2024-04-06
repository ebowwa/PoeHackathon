// app/api/fal/generate-video/route.ts
import * as fal from "@fal-ai/serverless-client";
import { NextResponse } from "next/server";
import config from "@/data/config.json";

interface FalVideoResult {
  url: string;
}

interface FalResult {
  videos: FalVideoResult[];
  prompt?: string;
  negative_prompt?: string;
  image_size?: {
    height: number;
    width: number;
  };
  num_inference_steps?: number;
  fps: number;
}

interface FalInput {
  prompt: string;
  negative_prompt: string;
  image_size: {
    height: number;
    width: number;
  };
  num_inference_steps?: number;
  fps: number;
  videos?: FalVideoResult[];
}

interface GenerateVideoResponse {
  videoUrl: string | null;
  error: string | null;
}

export async function GET(request: Request): Promise<NextResponse<GenerateVideoResponse>> {
  const result = await fal.subscribe<FalResult, FalInput>(
    config.video_model,
    {
      input: {
        prompt: `${config.prompt_prefix} ${config.prompt_suffix}`,
        negative_prompt: config.negative_prompt,
        image_size: {
          height: config.image_size.height,
          width: config.image_size.width,
        },
        num_inference_steps: config.num_inference_steps,
        fps: config.fps,
        videos: [], // Add this line to include the 'videos' property with an empty array
      },
      pollInterval: 5000,
      logs: true,
      onQueueUpdate(update) {
        console.log("queue update", update);
      },
    }
  );

  if (result.videos && result.videos.length > 0) {
    return NextResponse.json({ videoUrl: result.videos[0].url, error: null });
  } else {
    return NextResponse.json({ videoUrl: null, error: "No video generated" }, { status: 500 });
  }
}