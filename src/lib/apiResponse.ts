export async function readApiResponse(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(response.status === 429
      ? 'The service is busy. Wait a few minutes before trying again. Your records were not imported.'
      : 'The service could not complete this request. Your records were not imported. Please try again later.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The service returned an invalid response. Your records were not imported. Please try again later.');
  }
  return payload as Record<string, unknown>;
}
