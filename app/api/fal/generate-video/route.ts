// app/api/fal/generate-video/route.ts
import * as fal from "@fal-ai/serverless-client";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { EventStream, isValidRequest, PoeRequest } from "@/utils/poeUtils";
import { ApiError, ValidationError } from '@fal-ai/serverless-client/src/response';

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
  image_url: string;
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

interface GenerateVideoResponse {
  videoUrl: string | null;
  error: string | null;
}

export async function POST(request: Request): Promise<NextResponse<GenerateVideoResponse>> {
  // Check if the request is coming from the build process
  if (request.headers.get('x-vercel-deployment-type') === 'preview') {
    // Return a default response during the build process
    return NextResponse.json<GenerateVideoResponse>({ videoUrl: null, error: 'API not available during build' }, { status: 500 });
  }

  const falKey = process.env.NEXT_PUBLIC_FAL_KEY;

  if (!falKey) {
    return NextResponse.json<GenerateVideoResponse>(
      { videoUrl: null, error: "Missing API key" },
      { status: 500 }
    );
  }

  // Parse the request body
  const poeRequest = await request.json();
  const { query } = poeRequest as any;

  // Validate the request using the utility function
  if (!isValidRequest(poeRequest)) {
    return NextResponse.json<GenerateVideoResponse>(
      { videoUrl: null, error: "Invalid request" },
      { status: 400 }
    );
  }

  // Extract the required fields from the request body
  const {
    image_url,
    prompt_prefix,
    prompt_suffix,
    negativePrompt,
    image_size,
    num_inference_steps,
    fps,
  } = poeRequest as unknown as FalInput;

  // Configure the FAL API key
  fal.config({
    credentials: falKey,
  });

  const videoModel = process.env.VIDEO_MODEL || "fal-ai/fast-sdxl";

  try {
    const result = await fal.subscribe<FalResult, FalInput>(
      videoModel,
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

    // Log the complete FAL API response
    console.log("FAL API response:", result);

    if (result.videos && result.videos.length > 0) {
      // Generate a unique message ID
      const messageId = `m-${randomBytes(16).toString("hex")}`;

      // Create an EventStream instance
      const eventStream = new EventStream();

      // Send the text events with the generated video URL
      await eventStream.sendEvent("meta", { content_type: "text/markdown", suggested_replies: false });
      await eventStream.sendEvent("text", { text: `Here is the generated video: ${result.videos[0].url}` });
      await eventStream.sendEvent("done");

      // Close the EventStream
      await eventStream.close();

      // Get the readable stream from the EventStream
      const readable = eventStream.getReader();

      // Create a NextResponse with the readable stream and appropriate headers
      const response = new NextResponse<GenerateVideoResponse>(
        readable,
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          status: 200,
        }
      );

      return response;
    } else {
      // Handle the case when no video is generated
      console.error("No video generated");
      return NextResponse.json<GenerateVideoResponse>(
        { videoUrl: null, error: "No video generated" },
        { status: 500 }
      );
    }
  } catch (error) {
    // Handle any errors that occur during the FAL API request
    console.error("Error generating video:", error);
  
    if (error instanceof ApiError) {
      // Log the error details
      console.error("Error message:", error.message);
      console.error("Error status:", error.status);
      console.error("Error body:", error.body);
  
      if (error instanceof ValidationError) {
        // Handle validation errors
        console.error("Validation error occurred. Field errors:", error.fieldErrors);
  
        // Log field-specific errors
        const fieldErrors = error.getFieldErrors('prompt');
        if (fieldErrors.length > 0) {
          console.error("Prompt field errors:", fieldErrors);
        }
      }
    } else {
      console.error("An unknown error occurred:", error);
    }
  
    return NextResponse.json<GenerateVideoResponse>(
      { videoUrl: null, error: "An error occurred while generating the video" },
      { status: 500 }
    );
  }
}