const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/assets/js/contact.js', 'utf8');

function setup(fetchImpl, fields = { access_key: 'public-test-key', email: 'test@example.com' }) {
  let submit;
  const button = { textContent: 'Request Service', disabled: false };
  const status = { hidden: true, textContent: '', focus() { this.focused = true; } };
  const service = { options: [{ value: 'plumbing' }], value: '' };
  const state = { calls: 0, redirects: [], valid: true };
  const form = {
    action: 'https://api.web3forms.com/submit', dataset: { successUrl: '/thank-you/' },
    querySelector: () => button, reportValidity: () => state.valid,
    setAttribute() {}, removeAttribute() {},
    addEventListener(type, handler) { submit = handler; },
  };
  vm.runInNewContext(source, {
    document: { querySelector: selector => ({ '#service-265': service, '#cs-form-265': form, '#contact-form-status': status })[selector] },
    window: { location: { search: '?service=plumbing', assign: path => state.redirects.push(path) }, setTimeout, clearTimeout },
    URLSearchParams, AbortController,
    FormData: function () { return Object.entries(fields); },
    fetch: async (...args) => { state.calls++; return fetchImpl(...args); },
  });
  return { button, status, service, state, submit: () => submit({ preventDefault() {} }) };
}

(async () => {
  let resolve;
  const success = setup(() => new Promise(r => { resolve = r; }));
  assert.equal(success.service.value, 'plumbing');
  const pending = success.submit();
  assert.equal(success.button.disabled, true);
  await success.submit();
  assert.equal(success.state.calls, 1, 'Concurrent submission blocked');
  resolve({ ok: true, json: async () => ({ success: true }) });
  await pending;
  assert.deepEqual(success.state.redirects, ['/thank-you/']);
  await success.submit();
  assert.equal(success.state.calls, 1, 'Accepted submission cannot be repeated');

  for (const fetchImpl of [
    async () => ({ ok: false, json: async () => ({ success: false }) }),
    async () => ({ ok: true, json: async () => ({ success: false }) }),
    async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }),
    async () => { throw new Error('Network failure'); },
    async () => { const error = new Error('Timeout'); error.name = 'AbortError'; throw error; },
  ]) {
    const failure = setup(fetchImpl);
    await failure.submit();
    assert.equal(failure.button.disabled, false);
    assert.equal(failure.button.textContent, 'Request Service');
    assert.equal(failure.status.focused, true);
    assert.equal(failure.state.redirects.length, 0);
    assert.match(failure.status.textContent, /couldn't confirm/);
  }

  for (const fields of [{ access_key: '' }, { access_key: 'public-test-key', botcheck: 'on' }]) {
    const blocked = setup(() => { throw new Error('Must not send'); }, fields);
    await blocked.submit();
    assert.equal(blocked.state.calls, 0);
  }
  const invalid = setup(() => { throw new Error('Must not send'); });
  invalid.state.valid = false;
  await invalid.submit();
  assert.equal(invalid.state.calls, 0);
  console.log('Passed: service preselection, success, duplicate guard, API rejection, malformed response, network failure, timeout, missing key, honeypot, and validation. No live submissions sent.');
})();
