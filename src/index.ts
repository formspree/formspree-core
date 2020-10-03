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
  project?: string;
}

export class Client {
  project: string | undefined;
  private session: Session | undefined;

  constructor(config: Config = {}) {
    this.project = config.project;
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
    let endpoint = opts.endpoint || 'https://formspree.io';
    let fetchImpl = opts.fetchImpl || fetchPonyfill({ Promise }).fetch;
    let url = this.project
      ? `${endpoint}/p/${this.project}/f/${formKey}`
      : `${endpoint}/f/${formKey}`;

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
export const createClient = (config?: Config): Client => {
  return new Client(config);
};

/**
 * Fetches the global default client.
 */
export const getDefaultClient = (): Client => {
  if (!defaultClientSingleton) {
    defaultClientSingleton = createClient();
  }
  return defaultClientSingleton;
};

/**
 * The global default client. Note, this client may not get torn down.
 */
let defaultClientSingleton: Client;
