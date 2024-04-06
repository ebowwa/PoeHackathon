// app/api/fal/generate-video/route.ts
import * as fal from "@fal-ai/serverless-client";
import { NextResponse } from "next/server";
import config from "@/data/config.json";
import { randomBytes } from "crypto";

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
  const requestBody = await request.json();

  // Extract the required fields from the request body
  const {
    query,
    user_id,
    conversation_id,
    metadata,
    temperature,
    skip_system_prompt,
    stop_sequences,
    logit_bias,
  } = requestBody;

  // Validate the required fields
  if (!query || !user_id || !conversation_id) {
    return NextResponse.json<GenerateVideoResponse>(
      { videoUrl: null, error: "Missing required fields in the request body" },
      { status: 400 }
    );
  }

  // Configure the FAL API key
  fal.config({
    credentials: falKey,
  });

  try {
    const result = await fal.subscribe<FalResult, FalInput>(
      config.video_model,
      {
        input: {
          prompt: `${config.prompt_prefix} ${query[query.length - 1].content} ${config.prompt_suffix}`,
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
      // Generate a unique message ID
      const messageId = `m-${randomBytes(16).toString("hex")}`;

      // Send the text events with the generated video URL
      const textEvents = [
        {
          event: "meta",
          data: JSON.stringify({ content_type: "text/markdown", suggested_replies: false }),
        },
        {
          event: "text",
          data: JSON.stringify({ text: `Here is the generated video: ${result.videos[0].url}` }),
        },
        {
          event: "done",
          data: JSON.stringify({}),
        },
      ];

      // Send the server-sent events as the response
      const response = new NextResponse<GenerateVideoResponse>(
        new ReadableStream({
          async start(controller) {
            for (const event of textEvents) {
              controller.enqueue(new TextEncoder().encode(`${event.event}: ${event.data}\n\n`));
            }
            controller.close();
          },
        }),
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
      return NextResponse.json<GenerateVideoResponse>(
        { videoUrl: null, error: "No video generated" },
        { status: 500 }
      );
    }
  } catch (error) {
    // Handle any errors that occur during the FAL API request
    console.error("Error generating video:", error);

    // Extract the error details from the ValidationError
    let errorMessage = "An error occurred while generating the video";
    if (error instanceof fal.ValidationError) {
      const errorDetails = error.body.detail;
      if (Array.isArray(errorDetails) && errorDetails.length > 0) {
        errorMessage = errorDetails[0].msg || errorMessage;
      }
    }

    return NextResponse.json<GenerateVideoResponse>(
      { videoUrl: null, error: errorMessage },
      { status: 500 }
    );
  }
}