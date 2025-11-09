/**
 * Step 5: Compose HTML
 * Assemble HTML slots from LLM output + chart URLs
 */

export async function composeHtml(llmOutput: unknown, charts: unknown[]): Promise<Record<string, string>> {
  // TODO: Implement HTML composition
  // - Convert LLM output to HTML for each slot
  // - Inject chart URLs/images
  // - Sanitise HTML (DOMPurify)
  // - Enforce allowed classes whitelist
  // - Return slot dictionary
  throw new Error('composeHtml() not yet implemented');
}
