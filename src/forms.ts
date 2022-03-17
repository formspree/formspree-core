export type SubmissionData = FormData | object;

export interface SubmissionOptions {
  endpoint?: string;
  clientName?: string;
  fetchImpl?: typeof fetch;
}

export interface FormError {
  field?: string;
  code: string | null;
  message: string;
}

export interface FieldError extends FormError {
  field: string;
}

export function isFieldError(error: FormError): error is FieldError {
  return (error as FieldError).field !== undefined;
}

export interface SuccessBody {
  id: string;
  data: object;
}

export interface ErrorBody {
  errors: FormError[];
}

export type SubmissionBody = SuccessBody | ErrorBody;

export function hasErrors(body: SubmissionBody): body is ErrorBody {
  return (body as ErrorBody).errors !== undefined;
}

export interface SubmissionResponse {
  body: SubmissionBody;
  response: Response;
}
