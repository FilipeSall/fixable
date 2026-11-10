export type FieldIssue = { path: string[]; message: string };

export type SerializedError = { type: string; message: string; stack: string; [key: string]: unknown };
