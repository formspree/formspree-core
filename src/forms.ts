export type SubmissionData = FormData | object;

export interface SubmissionOptions {
  endpoint?: string;
  clientName?: string;
  fetchImpl?: typeof fetch;
}

export type FormErrorCode =
  | 'INACTIVE'
  | 'BLOCKED'
  | 'EMPTY'
  | 'PROJECT_NOT_FOUND'
  | 'FORM_NOT_FOUND'
  | 'NO_FILE_UPLOADS'
  | 'TOO_MANY_FILES'
  | 'FILES_TOO_BIG';

export type FieldErrorCode =
  | 'REQUIRED_FIELD_MISSING'
  | 'REQUIRED_FIELD_EMPTY'
  | 'TYPE_EMAIL'
  | 'TYPE_NUMERIC'
  | 'TYPE_TEXT';

export interface FormError {
  field?: string;
  code: FormErrorCode | FieldErrorCode | null;
  message: string;
}

export interface FieldError extends FormError {
  field: string;
  code: FieldErrorCode | null;
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
