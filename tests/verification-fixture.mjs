export const referenceUrl = 'https://openstax.org/books/physics/pages/4-3-newtons-second-law-of-motion';
export const output = text => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: typeof text === 'string' ? text : JSON.stringify(text) }] }] });
export const searchOutput = () => Response.json({ status: 'completed', output: [
  { type: 'web_search_call', status: 'completed' },
  { type: 'message', content: [{ type: 'output_text', text: 'Trusted educational reference for this synthetic test.', annotations: [{ type: 'url_citation', url: referenceUrl, title: 'Physics · OpenStax' }] }] },
] });
export function passingReport(body) {
  const input = JSON.parse(body.input);
  return { checks: input.items.map(item => ({ id: item.id, status: 'supported', quoteId: input.textbookQuoteChoices[0].id, referenceUrls: input.externalSources?.length ? [referenceUrl] : [], reason: '' })) };
}
export function withVerificationMock(generate) {
  return async (url, options) => {
    const body = JSON.parse(options.body);
    if (body.tools) return searchOutput();
    if (body.text?.format?.name === 'board_verification') return output(passingReport(body));
    return generate(url, options);
  };
}
