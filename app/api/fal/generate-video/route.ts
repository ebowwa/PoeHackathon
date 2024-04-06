import * as fal from "@fal-ai/serverless-client";
import { NextResponse } from "next/server";
import { isValidRequest, PoeRequest } from "@/utils/poeUtils";
import { ApiError, ValidationError } from "@fal-ai/serverless-client/src/response";

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

export async function POST(request: Request): Promise<NextResponse> {
  // Check if the request is coming from the build process
  if (request.headers.get("x-vercel-deployment-type") === "preview") {
    return NextResponse.json({ error: "API not available during build" }, { status: 500 });
  }

  const falKey = process.env.NEXT_PUBLIC_FAL_KEY;
  if (!falKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const poeRequest = await request.json();
  if (!isValidRequest(poeRequest)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { negativePrompt, image_size, num_inference_steps, fps } = poeRequest as unknown as FalInput;
  const { query, prompt_prefix, prompt_suffix } = poeRequest as any;

  fal.config({
    credentials: falKey,
  });

  try {
    const subscription = await fal.subscribe<FalResult, FalInput>(
      process.env.VIDEO_MODEL || "fal-ai/fast-sdxl",
      {
        input: {
          prompt: `${prompt_prefix} ${query[query.length - 1].content} ${prompt_suffix}`,
          negativePrompt,
          image_size,
          num_inference_steps,
          fps,
          videos: [],
        },
        pollInterval: 5000,
        logs: true,
        onQueueUpdate(update) {
          console.log("queue update", update);
        },
      }
    );

    const result: any = await subscription;
    const finalResult: FalResult = await result.getFinalResult();

    if (finalResult.videos && finalResult.videos.length > 0) {
      const videoUrl = finalResult.videos[0].url;
      return NextResponse.json({ videoUrl }, { status: 200 });
    } else {
      return NextResponse.json({ error: "No video generated" }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      console.error("API Error:", error.message);
      console.error("Error status:", error.status);
      console.error("Error body:", error.body);

      if (error instanceof ValidationError) {
        console.error("Validation error occurred. Field errors:", error.fieldErrors);
        const promptFieldErrors = error.getFieldErrors("prompt");
        if (promptFieldErrors.length > 0) {
          console.error("Prompt field errors:", promptFieldErrors);
        }
      }

      return NextResponse.json({ error: error.message }, { status: error.status });
    } else {
      console.error("An unknown error occurred:", error);
      return NextResponse.json({ error: "An unknown error occurred" }, { status: 500 });
    }
  }
}