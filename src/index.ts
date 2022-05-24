import PromisePolyfill from 'promise-polyfill';
import fetchPonyfill from 'fetch-ponyfill';
import { PaymentIntentResult, Stripe } from '@stripe/stripe-js';
import {
  SubmissionData,
  SubmissionOptions,
  SubmissionBody,
  SubmissionResponse
} from './forms';
import { clientHeader, encode64, handleServerResponse } from './utils';
import { Session } from './session';

export interface Config {
  project?: string;
  stripePromise?: Stripe;
}

export class Client {
  project: string | undefined;
  stripePromise: Stripe | undefined;
  private session: Session | undefined;

  constructor(config: Config = {}) {
    this.project = config.project;
    this.stripePromise = config.stripePromise;
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
  async submitForm(
    formKey: string,
    data: SubmissionData,
    opts: SubmissionOptions = {}
  ): Promise<SubmissionResponse> {
    let endpoint = opts.endpoint || 'https://formspree.io';
    let fetchImpl =
      opts.fetchImpl || fetchPonyfill({ Promise: PromisePolyfill }).fetch;
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

    if (this.stripePromise && opts.handlePayment) {
      // Get Stripe payload
      const payload = await opts.handlePayment();

      if (payload.error) {
        // Show error to user
        return {
          response: null,
          body: {
            errors: [
              {
                code: 'PAYMENT_METHOD_ERROR',
                message: 'Error creating payment method',
                field: 'paymentMethod'
              }
            ]
          }
        };
      } else {
        // Hit Formspree server with the payment method id to handle the payment
        const response = await fetchImpl(url, {
          ...request,
          body: serializeBody({
            ...data,
            paymentMethod: payload.paymentMethod.id
          })
        });
        const responseData = await response.json();

        // Prepare resubmission logic in case SCA was needed
        // @ts-ignore
        const resubmitForm = async (
          result: PaymentIntentResult,
          resubmitKey: string
        ) => {
          if (result.error) {
            return {
              // @TODO: figure out where to get the status code later on
              response: { ...serverResponse, status: 402 },
              body: {
                errors: [
                  {
                    code: 'STRIPE_SCA_ERROR',
                    message: 'Stripe SCA error',
                    field: 'paymentMethod'
                  }
                ]
              }
            };
          } else {
            const resSubmitResponse = await fetchImpl(url, {
              ...request,
              body: serializeBody({
                ...data,
                paymentMethod: payload.paymentMethod.id,
                paymentIntent: result.paymentIntent.id,
                resubmitKey: resubmitKey
              })
            });
            const resSubmitData = await resSubmitResponse.json();

            if (this.stripePromise) {
              const resubmitResult = await handleServerResponse(
                this.stripePromise,
                resSubmitData,
                resubmitForm
              );

              return resubmitResult;
            } else {
              return {
                // @TODO: figure out where to get the status code later on
                response: { ...serverResponse, status: 402 },
                body: {
                  errors: [
                    {
                      code: 'STRIPE_PROMISE_ERROR',
                      message: 'Stripe promise not initialised',
                      field: 'paymentMethod'
                    }
                  ]
                }
              };
            }
          }
        };

        // Server side validation
        // @ts-ignore
        const serverResponse = await handleServerResponse(
          this.stripePromise,
          responseData,
          resubmitForm
        );

        if (serverResponse === null) {
          return {
            body: {
              id: payload.paymentMethod.id,
              data: responseData
            },
            // @TODO: figure out where to get the status code later on
            response: { ...responseData, status: 200 }
          };
        } else {
          return {
            // @TODO: figure out where to get the status code later on
            response: { ...serverResponse, status: 402 },
            body: {
              errors: [serverResponse.error]
            }
          };
        }
      }
    } else {
      return fetchImpl(url, request).then(response => {
        return response.json().then(
          (body: SubmissionBody): SubmissionResponse => {
            return { body, response };
          }
        );
      });
    }
  }
}

/**
 * Constructs the client object.
 */
export const createClient = (config?: Config): Client => new Client(config);

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
