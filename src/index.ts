import Promise from 'promise-polyfill';
import fetchPonyfill from 'fetch-ponyfill';
import {
  SubmissionData,
  SubmissionOptions,
  SubmissionBody,
  SubmissionResponse
} from './forms';
import { clientHeader, encode64 } from './utils';
import { Session } from './session';

export interface Config {
  projectKey: string;
}

export class Client {
  projectKey: string;
  private session: Session | undefined;

  constructor(config: Config) {
    this.projectKey = config.projectKey;
    if (typeof window !== 'undefined') this.startBrowserSession();
  }

  /**
   * Starts a browser session.
   */
  startBrowserSession(): void {
    if (!this.session) {
      this.session = new Session();
    }
  }

  /**
   * Teardown the client session.
   */
  teardown(): void {
    if (this.session) this.session.teardown();
  }

  /**
   * Submit a form.
   *
   * @param formKey - The form key.
   * @param data - An object or FormData instance containing submission data.
   * @param args - An object of form submission data.
   */
  submitForm(
    formKey: string,
    data: SubmissionData,
    opts: SubmissionOptions = {}
  ): Promise<SubmissionResponse> {
    let endpoint = opts.endpoint || 'https://formspree-react.herokuapp.com';
    let fetchImpl = opts.fetchImpl || fetchPonyfill({ Promise }).fetch;
    let url = `${endpoint}/p/${this.projectKey}/f/${formKey}`;

    const serializeBody = (data: SubmissionData): FormData | string => {
      if (data instanceof FormData) return data;
      return JSON.stringify(data);
    };

    let headers: { [key: string]: string } = {
      Accept: 'application/json',
      'Formspree-Client': clientHeader(opts.clientName)
    };

    if (this.session) {
      headers['Formspree-Session-Data'] = encode64(this.session.data());
    }

    if (!(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    let request = {
      method: 'POST',
      mode: 'cors' as const,
      body: serializeBody(data),
      headers
    };

    return fetchImpl(url, request).then(response => {
      return response.json().then(
        (body: SubmissionBody): SubmissionResponse => {
          return { body, response };
        }
      );
    });
  }
}

/**
 * Constructs the client object.
 */
export const createClient = (config: Config): Client => {
  return new Client(config);
};
