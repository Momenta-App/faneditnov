import { envClient } from './env-client';

/**
 * Generates a mailto link for starting a campaign request
 * 
 * @param campaignId - The ID of the campaign
 * @param campaignName - The display name of the campaign
 * @param campaignPrompt - The original input text/prompt for the campaign
 * @returns A mailto URL string that can be used in a link or window.open()
 * 
 * @example
 * const mailtoLink = generateCampaignRequestEmail(
 *   '123e4567-e89b-12d3-a456-426614174000',
 *   'NBA Campaign',
 *   'NBA'
 * );
 * window.location.href = mailtoLink;
 */
export function generateCampaignRequestEmail(
  campaignId: string,
  campaignName: string,
  campaignPrompt: string
): string {
  // Get the base URL for the campaign link
  const baseUrl = envClient.NEXT_PUBLIC_APP_URL;
  const campaignUrl = `${baseUrl}/campaigns/${campaignId}`;

  // Build the email body with structured sections
  const emailBody = `I'm interested in starting a campaign based on the following:

Campaign Prompt: ${campaignPrompt}

Campaign Link: ${campaignUrl}

---

Company/Organization:
[Please provide information about your company or organization]

Campaign Goals:
[Please describe your campaign goals and objectives]

Budget:
[Please provide your budget information]`;

  // URL encode the subject and body
  const subject = encodeURIComponent(`Campaign Request: ${campaignName}`);
  const body = encodeURIComponent(emailBody);
  const recipient = 'everett@fanactivation.ai';

  // Construct the mailto link
  return `mailto:${recipient}?subject=${subject}&body=${body}`;
}

