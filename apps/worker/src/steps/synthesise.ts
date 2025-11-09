/**
 * Step 3: Synthesise
 * Generate report content via OpenAI Structured Outputs
 */

export async function synthesise(data: unknown): Promise<unknown> {
  // TODO: Implement LLM synthesis
  // - Load llm_output.json schema
  // - Construct system + user prompts
  // - Call OpenAI with Structured Outputs
  // - Validate response with AJV
  // - Repair loop if validation fails (max 2 attempts)
  throw new Error('synthesise() not yet implemented');
}
