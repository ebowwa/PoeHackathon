// app/api/fal/generate-video/route.ts
import * as fal from "@fal-ai/serverless-client";
import { NextResponse } from "next/server";

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
    "video-generation-model", // Replace with the actual video model name
    {
      input: {
        prompt: "Your video generation prompt",
        negative_prompt: "Negative prompt (if applicable)",
        image_size: {
          height: 512,
          width: 512,
        },
        num_inference_steps: 50,
        fps: 30,
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