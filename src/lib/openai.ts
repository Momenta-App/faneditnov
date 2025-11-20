import OpenAI from 'openai';
import { envServer } from './env-server';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: envServer.OPEN_AI_KEY,
});

export interface Team {
  team_name: string;
  team_hashtags: string[];
}

export interface CampaignSuggestion {
  sport: string;
  league: string;
  teams: Team[];
  global_hashtags: string[];
}

/**
 * Generate sports/league/team/hashtag suggestions for a region/market
 * Uses OpenAI function calling to get structured JSON response
 */
export async function generateCampaignSuggestions(
  inputText: string
): Promise<CampaignSuggestion[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert in sports, leagues, teams, and social media hashtags. 
When given a region or market (like "Canada", "India", "Spain", "Mexico"), you identify:
1. The largest and most relevant sports for that region
2. The main league for each sport
3. Up to 5 suggestions total
4. The most relevant teams within those sports
5. The hashtags associated with the sport, league, teams, and major players

Rules:
- The first suggestion should be the "everything bucket" - the biggest sport in that region with all leagues and teams
- Suggestions 2-5 should get more specific
- If a region only has one major team in a sport, that's fine
- Only sports, not movies or films
- Examples:
  - Canada → Hockey, NHL, Maple Leafs, etc.
  - India → Cricket, national team or cricket league
  - Spain → Football, La Liga, Barcelona, Real Madrid
  - Mexico → Liga MX, big four clubs`,
        },
        {
          role: 'user',
          content: `Generate sports suggestions for: ${inputText}`,
        },
      ],
      functions: [
        {
          name: 'get_sports_suggestions',
          description: 'Get sports, leagues, teams, and hashtags for a region or market',
          parameters: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                description: 'Array of up to 5 suggestions',
                items: {
                  type: 'object',
                  properties: {
                    sport: {
                      type: 'string',
                      description: 'The sport name (e.g., "Hockey", "Cricket", "Football")',
                    },
                    league: {
                      type: 'string',
                      description: 'The main league for this sport (e.g., "NHL", "IPL", "La Liga")',
                    },
                    teams: {
                      type: 'array',
                      description: 'Array of teams in this sport/league',
                      items: {
                        type: 'object',
                        properties: {
                          team_name: {
                            type: 'string',
                            description: 'The team name (e.g., "Toronto Maple Leafs", "Mumbai Indians")',
                          },
                          team_hashtags: {
                            type: 'array',
                            description: 'Array of hashtags associated with this team',
                            items: {
                              type: 'string',
                            },
                          },
                        },
                        required: ['team_name', 'team_hashtags'],
                      },
                    },
                    global_hashtags: {
                      type: 'array',
                      description: 'Array of global hashtags for the sport, league, and major players',
                      items: {
                        type: 'string',
                      },
                    },
                  },
                  required: ['sport', 'league', 'teams', 'global_hashtags'],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      ],
      function_call: { name: 'get_sports_suggestions' },
      temperature: 0.7,
    });

    const functionCall = response.choices[0]?.message?.function_call;
    if (!functionCall || functionCall.name !== 'get_sports_suggestions') {
      throw new Error('OpenAI did not return function call');
    }

    const args = JSON.parse(functionCall.arguments);
    const suggestions: CampaignSuggestion[] = args.suggestions || [];

    // Validate and normalize hashtags
    return suggestions.map((suggestion) => ({
      ...suggestion,
      teams: suggestion.teams.map((team) => ({
        ...team,
        team_hashtags: team.team_hashtags.map((tag) =>
          normalizeHashtag(tag)
        ),
      })),
      global_hashtags: suggestion.global_hashtags.map((tag) =>
        normalizeHashtag(tag)
      ),
    }));
  } catch (error) {
    console.error('Error generating campaign suggestions:', error);
    throw new Error(
      `Failed to generate campaign suggestions: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Normalize hashtag: lowercase, remove #, trim
 */
function normalizeHashtag(tag: string): string {
  return tag.toLowerCase().replace(/^#/, '').trim();
}

/**
 * Extract all hashtags from a campaign suggestion
 * Combines team_hashtags and global_hashtags
 */
export function extractHashtagsFromSuggestion(
  suggestion: CampaignSuggestion
): string[] {
  const hashtags = new Set<string>();

  // Add global hashtags
  suggestion.global_hashtags.forEach((tag) => {
    const normalized = normalizeHashtag(tag);
    if (normalized) hashtags.add(normalized);
  });

  // Add team hashtags
  suggestion.teams.forEach((team) => {
    team.team_hashtags.forEach((tag) => {
      const normalized = normalizeHashtag(tag);
      if (normalized) hashtags.add(normalized);
    });
  });

  return Array.from(hashtags);
}

