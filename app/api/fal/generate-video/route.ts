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
  prompt_prefix: string;
  prompt_suffix: string;
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

  // Parse the request body
  const poeRequest = await request.json();

  // Validate the request using the utility function
  if (!isValidRequest(poeRequest)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Extract the required fields from the request body
  const {
    negativePrompt,
    image_size,
    num_inference_steps,
    fps,
    prompt_prefix,
    prompt_suffix,
  } = poeRequest as unknown as FalInput;
  const { query } = poeRequest as any;

  // Configure the FAL API key
  fal.config({
    credentials: falKey,
  });

  const videoModel = process.env.VIDEO_MODEL || "fal-ai/fast-sdxl";

  try {
    const result = await fal.subscribe<FalResult, FalInput>(videoModel, {
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
    });

    if (result.videos && result.videos.length > 0) {
      const videoUrl = result.videos[0].url;
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