import { createClient } from '../src';
import { version } from '../package.json';

// A fake success result for a mocked `fetch` call.
//
// Example:
//
//   const mockFetch = (_url, props) => {
//     return success;
//   };
//
const success = new Promise((resolve, _reject) => {
  const response = {
    status: 200,
    json: () => {
      return new Promise(resolve => {
        resolve({ id: 'xxx' });
      });
    }
  };
  resolve(response);
});

it('resolves with body and response when successful', () => {
  const mockFetch = (url, props) => {
    expect(props.method).toEqual('POST');
    expect(props.mode).toEqual('cors');
    expect(url).toEqual(
      'https://formspree-react.herokuapp.com/p/111/f/newsletter'
    );
    return success;
  };

  return createClient({ projectKey: '111' })
    .submitForm(
      'newsletter',
      {},
      {
        fetchImpl: mockFetch
      }
    )
    .then(({ body, response }) => {
      expect(body.id).toEqual('xxx');
      expect(response.status).toEqual(200);
    })
    .catch(e => {
      throw e;
    });
});

it('uses a default client header if none is given', () => {
  const mockFetch = (_url, props) => {
    expect(props.headers['Formspree-Client']).toEqual(
      `@formspree/core@${version}`
    );

    return success;
  };

  return createClient({ projectKey: '111' }).submitForm(
    'newsletter',
    {},
    {
      fetchImpl: mockFetch
    }
  );
});

it('puts given client name in the client header', () => {
  const mockFetch = (_url, props) => {
    expect(props.headers['Formspree-Client']).toEqual(
      `my-client @formspree/core@${version}`
    );

    return success;
  };

  return createClient({ projectKey: '111' }).submitForm(
    'newsletter',
    {},
    {
      clientName: 'my-client',
      fetchImpl: mockFetch
    }
  );
});

it('sets content type to json if data is not FormData', () => {
  const mockFetch = (_url, props) => {
    expect(props.headers['Content-Type']).toEqual('application/json');

    const parsedBody = JSON.parse(props.body);
    expect(parsedBody.foo).toEqual('bar');
    return success;
  };

  return createClient({ projectKey: '111' }).submitForm(
    'newsletter',
    { foo: 'bar' },
    { fetchImpl: mockFetch }
  );
});

it('sends telemetry data if session is started', () => {
  const mockFetch = (_url, props) => {
    expect(props.headers['Content-Type']).toEqual('application/json');

    const parsedBody = JSON.parse(props.body);
    expect(parsedBody._t).toBeDefined();
    return success;
  };

  const client = createClient({ projectKey: '111' });
  client.startBrowserSession();
  return client.submitForm('newsletter', {}, { fetchImpl: mockFetch });
});
