import PromisePolyfill from 'promise-polyfill';
import fetchPonyfill from 'fetch-ponyfill';
import { Stripe } from '@stripe/stripe-js';
import {
  SubmissionData,
  SubmissionOptions,
  SubmissionBody,
  SubmissionResponse
} from './forms';
import { appendExtraData, clientHeader, encode64 } from './utils';
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

    // first check if we need to add the stripe paymentMethod
    if (this.stripePromise && opts.createPaymentMethod) {
      // Get Stripe payload
      const payload = await opts.createPaymentMethod();

      if (payload.error) {
        // Return the error in case Stripe failed to create a payment method
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
      }

      // Add the paymentMethod to the data
      appendExtraData(data, 'paymentMethod', payload.paymentMethod.id);

      // Send a request to Formspree server to handle the payment method
      const response = await fetchImpl(url, {
        ...request,
        body: data
      });
      const responseData = await response.json();

      // Handle server side errors
      if (responseData.error) {
        return {
          response,
          body: {
            errors: responseData.errors
          }
        };
      }

      // Handle success response
      if (responseData.next && responseData.ok) {
        return {
          response,
          body: responseData
        };
      }

      // Handle SCA
      if (
        responseData &&
        responseData.stripe &&
        responseData.stripe.requiresAction &&
        responseData.resubmitKey
      ) {
        const stripeResult = await this.stripePromise.handleCardAction(
          responseData.stripe.paymentIntentClientSecret
        );

        // Handle Stripe error
        if (stripeResult.error) {
          return {
            response,
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
          if (!payload.paymentMethod.id) {
            appendExtraData(data, 'paymentMethod', payload.paymentMethod.id);
          }
          appendExtraData(data, 'paymentIntent', stripeResult.paymentIntent.id);
          appendExtraData(data, 'resubmitKey', responseData.resubmitKey);

          // Resubmit the form with the paymentIntent and resubmitKey
          const resSubmitResponse = await fetchImpl(url, {
            ...request,
            body: JSON.stringify({
              paymentIntent: stripeResult.paymentIntent.id,
              resubmitKey: responseData.resubmitKey
            })
          });
          const resSubmitData = await resSubmitResponse.json();

          // Handle success for resubmission
          if (resSubmitData.next && resSubmitData.ok) {
            return {
              response: resSubmitResponse,
              body: resSubmitData
            };
          }

          // Handle server side errors for resubmission
          if (resSubmitData.errors) {
            return {
              response: resSubmitResponse,
              body: {
                errors: resSubmitData.errors
              }
            };
          }
        }
      }

      return {
        response,
        body: {
          errors: responseData.errors
        }
      };
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
