// utils/poeUtils.ts

export type Role = 'system' | 'user' | 'bot';

export interface Message {
  role: Role;
  content: string;
  content_type: string;
  timestamp: number;
  message_id: string;
  feedback?: Feedback[];
  attachments?: Attachment[];
}

export interface Feedback {
  type: 'like' | 'dislike';
  reason?: string;
}

export interface Attachment {
  url: string;
  content_type: string;
  name: string;
  parsed_content?: string;
}

export interface QueryRequest {
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

export interface SettingsRequest {
  version: string;
  type: 'settings';
}

export interface ReportFeedbackRequest {
  version: string;
  type: 'report_feedback';
  message_id: string;
  user_id: string;
  conversation_id: string;
  feedback_type: 'like' | 'dislike';
}

export interface ReportErrorRequest {
  version: string;
  type: 'report_error';
  message: string;
  metadata: Record<string, unknown>;
}

export type PoeRequest =
  | QueryRequest
  | SettingsRequest
  | ReportFeedbackRequest
  | ReportErrorRequest;

export class EventStream {
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

export function isValidRequest(request: PoeRequest): boolean {
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