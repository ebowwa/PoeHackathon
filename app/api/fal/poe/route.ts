// pages/api/poe.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = "edge"

type Role = 'system' | 'user' | 'bot';

interface Message {
  role: Role;
  content: string;
  content_type: string;
  timestamp: number;
  message_id: string;
  feedback?: Feedback[];
  attachments?: Attachment[];
}

interface Feedback {
  type: 'like' | 'dislike';
  reason?: string;
}

interface Attachment {
  url: string;
  content_type: string;
  name: string;
  parsed_content?: string;
}

interface QueryRequest {
  version: string;
  type: 'query';
  query: Message[];
  message_id: string;
  user_id: string;
  conversation_id: string;
  metadata: string;
  temperature?: number;
  skip_system_prompt?: boolean;
  stop_sequences?: string[];
  logit_bias?: Record<string, number>;
}

interface SettingsRequest {
  version: string;
  type: 'settings';
}

interface ReportFeedbackRequest {
  version: string;
  type: 'report_feedback';
  message_id: string;
  user_id: string;
  conversation_id: string;
  feedback_type: 'like' | 'dislike';
}

interface ReportErrorRequest {
  version: string;
  type: 'report_error';
  message: string;
  metadata: Record<string, unknown>;
}

type PoeRequest =
  | QueryRequest
  | SettingsRequest
  | ReportFeedbackRequest
  | ReportErrorRequest;

  class EventStream {
    private readonly encoder = new TextEncoder();
    private readonly readable: ReadableStream<Uint8Array>;
    private readonly writable: WritableStream<Uint8Array>;
    private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  
    constructor() {
      const { readable, writable } = new TransformStream<Uint8Array>();
      this.readable = readable;
      this.writable = writable;
      this.writer = writable.getWriter();
    }

  async sendEvent(event: string, data?: Record<string, unknown>) {
    const eventString = `event: ${event}\n`;
    await this.writer.write(this.encoder.encode(eventString));

    if (data) {
      const dataString = `data: ${JSON.stringify(data)}\n\n`;
      await this.writer.write(this.encoder.encode(dataString));
    } else {
      await this.writer.write(this.encoder.encode('\n'));
    }
  }

  async sendJson(data: Record<string, unknown>) {
    const jsonString = JSON.stringify(data);
    await this.writer.write(this.encoder.encode(`data: ${jsonString}\n\n`));
  }

  async close() {
    await this.writer.close();
  }

  getReader() {
    return this.readable;
  }
}

export async function POST(request: NextRequest) {
  const poeRequest = await request.json() as PoeRequest;

  if (!isValidRequest(poeRequest)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const eventStream = new EventStream();
  const response = new NextResponse(eventStream.getReader(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });

  switch (poeRequest.type) {
    case 'query':
      await handleQueryRequest(poeRequest, eventStream);
      break;
    case 'settings':
      await handleSettingsRequest(eventStream);
      break;
    case 'report_feedback':
      await handleReportFeedbackRequest(poeRequest);
      break;
    case 'report_error':
      await handleReportErrorRequest(poeRequest);
      break;
    default:
      eventStream.sendEvent('error', { error_type: 'unknown_request_type' });
  }

  eventStream.close();

  return response;
}

function isValidRequest(request: PoeRequest): boolean {
  // Perform validation checks on the request
  // Return true if the request is valid, false otherwise

  // Check if the required fields are present based on the request type
  if (!request.version || !request.type) {
    return false;
  }

  switch (request.type) {
    case 'query':
      if (
        !request.query ||
        !request.message_id ||
        !request.user_id ||
        !request.conversation_id ||
        !request.metadata
      ) {
        return false;
      }
      break;
    case 'report_feedback':
      if (
        !request.message_id ||
        !request.user_id ||
        !request.conversation_id ||
        !request.feedback_type
      ) {
        return false;
      }
      break;
    case 'report_error':
      if (!request.message || !request.metadata) {
        return false;
      }
      break;
  }

  return true;
}

async function handleQueryRequest(
  request: QueryRequest,
  eventStream: EventStream
) {
  // Process the query request and send events to the client
  eventStream.sendEvent('meta', {
    content_type: 'text/markdown',
    suggested_replies: true,
  });

  eventStream.sendEvent('text', { text: 'The' });
  await new Promise((resolve) => setTimeout(resolve, 500));

  eventStream.sendEvent('text', { text: ' capital of Nepal is' });
  await new Promise((resolve) => setTimeout(resolve, 500));

  eventStream.sendEvent('text', { text: ' Kathmandu.' });
  await new Promise((resolve) => setTimeout(resolve, 500));

  eventStream.sendEvent('suggested_reply', {
    text: 'What is the population of Kathmandu?',
  });
  eventStream.sendEvent('suggested_reply', {
    text: 'Tell me more about Nepal.',
  });

  eventStream.sendEvent('done');
}

async function handleSettingsRequest(eventStream: EventStream) {
  // Process the settings request and send the response
  const settings = {
    server_bot_dependencies: { 'GPT-3.5-Turbo': 1 },
    allow_attachments: true,
    expand_text_attachments: true,
    enable_image_comprehension: false,
    introduction_message: 'Hello! I am an AI assistant.',
    enforce_author_role_alternation: false,
  };

  eventStream.sendJson(settings);
  eventStream.close();
}

async function handleReportFeedbackRequest(request: ReportFeedbackRequest) {
  // Process the report feedback request
  console.log('Received feedback:', request.feedback_type);
  console.log('Message ID:', request.message_id);
  console.log('User ID:', request.user_id);
  console.log('Conversation ID:', request.conversation_id);
  // Implement your own logic to handle the feedback
}

async function handleReportErrorRequest(request: ReportErrorRequest) {
  // Process the report error request
  console.error('Error reported:', request.message);
  console.error('Metadata:', request.metadata);
  // Implement your own logic to handle the error
}