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
  negativePrompt?: string;
  image_size?: {
    height: number;
    width: number;
  };
  num_inference_steps?: number;
  fps: number;
}

interface FalInput {
  prompt: string;
  negativePrompt: string;
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
  // Check if the request is coming from the build process
  if (request.headers.get('x-vercel-deployment-type') === 'preview') {
    // Return a default response during the build process
    return NextResponse.json({ videoUrl: null, error: 'API not available during build' }, { status: 500 });
  }

  const falKey = process.env.NEXT_PUBLIC_FAL_KEY;

  if (!falKey) {
    return NextResponse.json(
      { videoUrl: null, error: "Missing API key" },
      { status: 500 }
    );
  }

  // Configure the FAL API key
  fal.config({
    credentials: falKey,
  });

  const result = await fal.subscribe<FalResult, FalInput>(
    config.video_model,
    {
      input: {
        prompt: `${config.prompt_prefix} ${config.prompt_suffix}`,
        negativePrompt: config.negative_prompt,
        image_size: {
          height: config.image_size.height,
          width: config.image_size.width,
        },
        num_inference_steps: config.num_inference_steps,
        fps: config.fps,
        videos: [],
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