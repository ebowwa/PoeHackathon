import { route } from "@fal-ai/serverless-proxy/nextjs";

// Custom route handler for POST requests
export const POST = route.POST;

// Use the built-in proxy handler for GET requests
export const GET = route.GET;