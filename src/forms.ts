export type SubmissionData = FormData | object;

export interface SubmissionOptions {
  endpoint?: string;
  clientName?: string;
  fetchImpl?: typeof fetch;
}

interface ValidationError {
  field?: string;
  code: string | null;
  message: string;
}

interface SubmissionBodyBase {
  errors?: ValidationError[]
  id?: string;
  data?: object;
}

interface SuccessBody extends SubmissionBodyBase {
  id: string;
  data: object;
}

interface ErrorBody extends SubmissionBodyBase {
  errors: Array<{
    field?: string;
    code: string | null;
    message: string;
  }>;
}

export type SubmissionBody = SuccessBody | ErrorBody;

export interface SubmissionResponse {
  body: SubmissionBody;
  response: Response;
}
