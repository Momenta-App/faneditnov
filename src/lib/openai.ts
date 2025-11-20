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

export interface Character {
  character_name: string;
  character_hashtags: string[];
}

export interface DemographicsLocation {
  name: string;
  percentage: number;
}

export interface Demographics {
  type: 'country' | 'city';
  locations: DemographicsLocation[];
}

export interface CampaignSuggestion {
  category: 'sports' | 'media';
  // Sports fields
  sport?: string;
  league?: string;
  teams?: Team[];
  // Media fields
  franchise?: string;
  series?: string;
  characters?: Character[];
  // Common fields
  global_hashtags: string[];
  demographics?: Demographics;
}

/**
 * Generate ONE campaign suggestion for sports or media IP
 * Uses OpenAI function calling to get structured JSON response
 * Returns only one suggestion based on category detection
 */
export async function generateCampaignSuggestions(
  inputText: string
): Promise<CampaignSuggestion[]> {
  try {
    const category = detectCategory(inputText);
    
    let suggestions: CampaignSuggestion[];
    if (category === 'media') {
      suggestions = await generateMediaSuggestion(inputText);
    } else {
      suggestions = await generateSportsSuggestion(inputText);
    }

    // Generate demographics for each suggestion
    for (const suggestion of suggestions) {
      const hashtags = extractHashtagsFromSuggestion(suggestion);
      suggestion.demographics = await generateDemographics(inputText, hashtags);
    }

    return suggestions;
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
 * Generate sports campaign suggestion
 */
async function generateSportsSuggestion(inputText: string): Promise<CampaignSuggestion[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
        {
          role: 'system',
          content: `You are an expert in sports, leagues, teams, and social media hashtags. 
When given a region or market (like "Canada", "India", "Spain", "Mexico"), you identify:
1. The TOP sport for that region (the most popular/biggest sport)
2. The main league for that sport
3. The most relevant teams (top 3-5 teams)
4. Comprehensive hashtags for the sport, league, teams, and major players

Rules:
- Return ONLY ONE suggestion - the biggest/most popular sport in that region
- Focus on the top sport (e.g., Cricket for India, Hockey for Canada, Football for Spain)
- Include the main league (e.g., IPL for India cricket, NHL for Canada hockey, La Liga for Spain football)
- Include top 3-5 teams from that league
- Generate comprehensive hashtags (20-30 hashtags) in global_hashtags including:
  - Sport name hashtags (e.g., cricket, cricketlovers, cricketfans, cricketsport)
  - League name hashtags (e.g., ipl, ipl2024, indianpremierleague)
  - Full team name hashtags (e.g., mumbaiindians, chennaisuperkings, delhicapitals, not just abbreviations like "MI", "CSK", or "DC")
  - Major player hashtags (if applicable)
  - Regional/country hashtags related to the sport (e.g., indiancricket, cricketindia)
  - Popular sport-related terms (e.g., t20, odi, testcricket for cricket)
- CRITICAL: NEVER use two-letter abbreviations (like "DC", "MI", "CSK", "KK", "RR", etc.) in global_hashtags. These abbreviations are highly ambiguous and can match unrelated content:
  - "DC" could match DC Comics (Superman, Batman, etc.) instead of Delhi Capitals cricket team
  - "MI" could match Michigan or other unrelated content
  - Two-letter abbreviations are too generic and will pull in videos from other sports, media IP, or unrelated topics
- ALWAYS use full team names or descriptive terms in global_hashtags (e.g., "delhicapitals", "mumbaiindians", "chennaisuperkings", not "dc", "mi", "csk")
- Team hashtags in team_hashtags can include abbreviations for team-specific targeting, but global_hashtags must use full names to avoid cross-contamination with other IP or teams.
- Examples:
  - "India" → Cricket, IPL, with global_hashtags: cricket, ipl, cricketlovers, indiancricket, t20, cricketfans, ipl2024, cricketsport, cricketworld, cricketlife, etc.
  - "Canada" → Hockey, NHL, with global_hashtags: hockey, nhl, hockeylife, icehockey, hockeyfans, nhlhockey, canadianhockey, hockeyplayer, etc.
  - "Spain" → Football, La Liga, with global_hashtags: football, laliga, soccer, footballfans, spanishfootball, laligafootball, footballlife, etc.`,
        },
      {
        role: 'user',
        content: `Generate the top sports suggestion for: ${inputText}`,
      },
    ],
    functions: [
      {
        name: 'get_sports_suggestion',
        description: 'Get the top sport, league, teams, and hashtags for a region or market',
        parameters: {
          type: 'object',
          properties: {
            sport: {
              type: 'string',
              description: 'The top sport name (e.g., "Hockey", "Cricket", "Football")',
            },
            league: {
              type: 'string',
              description: 'The main league for this sport (e.g., "NHL", "IPL", "La Liga")',
            },
            teams: {
              type: 'array',
              description: 'Array of top 3-5 teams in this sport/league',
              items: {
                type: 'object',
                properties: {
                  team_name: {
                    type: 'string',
                    description: 'The team name (e.g., "Toronto Maple Leafs", "Mumbai Indians")',
                  },
                  team_hashtags: {
                    type: 'array',
                    description: 'Array of hashtags associated with this specific team. Can include full team name, nicknames, and abbreviations. NOTE: If using abbreviations, prefer longer ones (3+ letters) or combine with context (e.g., "dcricket" instead of just "dc" to avoid matching DC Comics). These are separate from global_hashtags.',
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
              description: 'Comprehensive array of 20-30 hashtags focused on the SPORT and LEAGUE broadly. CRITICAL: NEVER include two-letter abbreviations (like "DC", "MI", "CSK") as these are ambiguous and will match unrelated content (e.g., "DC" matches DC Comics/Superman content). Always use full team names (e.g., "delhicapitals", "mumbaiindians", "chennaisuperkings"). Include: sport name variations, league name variations, popular sport terms, country/region + sport combinations, and full team names. Examples for cricket: cricket, ipl, cricketlovers, indiancricket, t20, cricketfans, ipl2024, cricketsport, cricketworld, cricketlife, cricketmatch, cricketgame, delhicapitals, mumbaiindians, etc.',
              items: {
                type: 'string',
              },
            },
          },
          required: ['sport', 'league', 'teams', 'global_hashtags'],
        },
      },
    ],
    function_call: { name: 'get_sports_suggestion' },
    temperature: 0.7,
  });

  const functionCall = response.choices[0]?.message?.function_call;
  if (!functionCall || functionCall.name !== 'get_sports_suggestion') {
    throw new Error('OpenAI did not return function call');
  }

  const rawSuggestion = JSON.parse(functionCall.arguments);

  // Normalize hashtags and add edit variants
  const normalized: CampaignSuggestion = {
    category: 'sports',
    sport: rawSuggestion.sport,
    league: rawSuggestion.league,
    teams: rawSuggestion.teams.map((team: Team) => ({
      ...team,
      team_hashtags: addEditVariants(team.team_hashtags),
    })),
    global_hashtags: addEditVariants(rawSuggestion.global_hashtags),
  };

  return [normalized];
}

/**
 * Generate media IP campaign suggestion
 */
async function generateMediaSuggestion(inputText: string): Promise<CampaignSuggestion[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert in movies, TV shows, anime, franchises, and social media hashtags.
When given a media IP (like "Marvel", "Iron Man", "Disney", "Anime", "Stranger Things"), you identify:
1. The franchise or series name
2. The main series or universe (e.g., MCU, DCEU, specific anime series)
3. The most relevant characters (top 3-5 characters)
4. Comprehensive hashtags for the franchise, series, characters, and related content

Rules:
- Return ONLY ONE suggestion - the most relevant media IP
- Focus on the main franchise or series
- Include top 3-5 characters from that franchise/series
- Generate comprehensive hashtags including:
  - Franchise name hashtags
  - Series name hashtags
  - Character name hashtags
  - Related content hashtags
- Examples:
  - "Marvel" → MCU, Iron Man, Captain America, etc. with Marvel hashtags
  - "Iron Man" → MCU, Iron Man, Tony Stark, etc. with Iron Man hashtags
  - "Anime" → Popular anime series, characters, etc. with anime hashtags
  - "Disney" → Disney movies, characters, etc. with Disney hashtags`,
      },
      {
        role: 'user',
        content: `Generate the top media IP suggestion for: ${inputText}`,
      },
    ],
    functions: [
      {
        name: 'get_media_suggestion',
        description: 'Get the top franchise, series, characters, and hashtags for a media IP',
        parameters: {
          type: 'object',
          properties: {
            franchise: {
              type: 'string',
              description: 'The franchise name (e.g., "Marvel", "Disney", "Star Wars")',
            },
            series: {
              type: 'string',
              description: 'The main series or universe (e.g., "MCU", "DCEU", "One Piece")',
            },
            characters: {
              type: 'array',
              description: 'Array of top 3-5 characters from this franchise/series',
              items: {
                type: 'object',
                properties: {
                  character_name: {
                    type: 'string',
                    description: 'The character name (e.g., "Iron Man", "Tony Stark", "Luffy")',
                  },
                  character_hashtags: {
                    type: 'array',
                    description: 'Array of hashtags associated with this character',
                    items: {
                      type: 'string',
                    },
                  },
                },
                required: ['character_name', 'character_hashtags'],
              },
            },
            global_hashtags: {
              type: 'array',
              description: 'Comprehensive array of hashtags for the franchise, series, characters, and related content (20-30 hashtags)',
              items: {
                type: 'string',
              },
            },
          },
          required: ['franchise', 'series', 'characters', 'global_hashtags'],
        },
      },
    ],
    function_call: { name: 'get_media_suggestion' },
    temperature: 0.7,
  });

  const functionCall = response.choices[0]?.message?.function_call;
  if (!functionCall || functionCall.name !== 'get_media_suggestion') {
    throw new Error('OpenAI did not return function call');
  }

  const rawSuggestion = JSON.parse(functionCall.arguments);

  // Normalize hashtags and add edit variants
  const normalized: CampaignSuggestion = {
    category: 'media',
    franchise: rawSuggestion.franchise,
    series: rawSuggestion.series,
    characters: rawSuggestion.characters.map((character: Character) => ({
      ...character,
      character_hashtags: addEditVariants(character.character_hashtags),
    })),
    global_hashtags: addEditVariants(rawSuggestion.global_hashtags),
  };

  return [normalized];
}

/**
 * Detect if input is sports or media IP based on keywords
 */
export function detectCategory(inputText: string): 'sports' | 'media' {
  const lowerText = inputText.toLowerCase();
  
  // Media keywords
  const mediaKeywords = [
    'marvel', 'disney', 'iron man', 'anime', 'tv show', 'tv', 'television',
    'movie', 'film', 'franchise', 'character', 'mcu', 'dc', 'comics',
    'star wars', 'harry potter', 'game of thrones', 'stranger things',
    'netflix', 'hbo', 'disney+', 'series', 'show', 'episode'
  ];
  
  // Check for media keywords
  for (const keyword of mediaKeywords) {
    if (lowerText.includes(keyword)) {
      return 'media';
    }
  }
  
  // Default to sports (countries, regions, or ambiguous)
  return 'sports';
}

/**
 * Normalize hashtag: lowercase, remove #, trim
 */
function normalizeHashtag(tag: string): string {
  return tag.toLowerCase().replace(/^#/, '').trim();
}

/**
 * Add "edit" suffix variant to hashtags
 * Returns array with both original and "edit" version
 */
function addEditVariants(hashtags: string[]): string[] {
  const result = new Set<string>();
  
  hashtags.forEach((tag) => {
    const normalized = normalizeHashtag(tag);
    if (normalized) {
      // Add original
      result.add(normalized);
      // Add edit variant (only if it doesn't already end with "edit")
      if (!normalized.endsWith('edit')) {
        result.add(`${normalized}edit`);
      }
    }
  });
  
  return Array.from(result);
}

/**
 * Generate fake demographics data based on input text and hashtags
 * Uses AI to determine if input is a country or city and generates realistic distribution
 */
export async function generateDemographics(
  inputText: string,
  hashtags: string[]
): Promise<Demographics> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert in geographic demographics and social media analytics.
Your task is to generate realistic fake demographics data showing where viewership is coming from.

CRITICAL ANALYSIS RULES:
1. First, determine if the input_text is a COUNTRY (e.g., "Canada", "India", "Spain") or a CITY (e.g., "Toronto", "Mumbai", "Madrid")
2. MOST IMPORTANT: Analyze the hashtags carefully for COUNTRY-SPECIFIC TEAM INDICATORS. Do NOT just look at the sport globally.
   - Look for team names that indicate specific countries (e.g., "mumbaiindians", "chennaisuperkings", "delhicapitals" = India; "torontomapleleafs", "montrealcanadiens" = Canada; "realmadrid", "barcelona" = Spain)
   - If you see country-specific team hashtags, that country should get a MUCH HIGHER percentage (65-75%+), not just a small boost
   - The presence of country-specific teams means the campaign is heavily targeted to that country, not just the sport globally
3. If the input_text mentions a specific country AND hashtags contain that country's teams, give that country 65-75%+ (very high concentration)
4. If the input_text mentions a country but hashtags are generic (no country-specific teams), give it 55-65% (moderate boost)
5. For sports: When country-specific teams are present, focus heavily on that country. Other countries should get much lower percentages (5-15% each)
6. For media: Consider global distribution with focus on major markets (USA, UK, Canada, Australia, etc.)
7. Generate exactly 5 locations:
   - Top 4 specific locations (countries or cities depending on input type)
   - If country-specific teams are detected, that country should be #1 with 65-75%+
   - 5th location is always "Other" containing the remaining percentage
8. Percentages must sum to exactly 100%
9. Make the data realistic but clearly fake (for demo purposes)
10. If input is a country, return countries. If input is a city, return cities.

Examples:
- Input: "India", hashtags: ["cricket", "ipl", "mumbaiindians", "chennaisuperkings", "delhicapitals", "cricketlovers"] 
  → type: "country", locations: [{name: "India", percentage: 72}, {name: "Pakistan", percentage: 10}, {name: "Bangladesh", percentage: 8}, {name: "United Kingdom", percentage: 5}, {name: "Other", percentage: 5}]
  Note: India gets 72% because hashtags contain Indian IPL teams (mumbaiindians, chennaisuperkings, delhicapitals), indicating heavy India focus
  
- Input: "Canada", hashtags: ["hockey", "nhl", "torontomapleleafs", "montrealcanadiens", "hockeylife"] 
  → type: "country", locations: [{name: "Canada", percentage: 68}, {name: "United States", percentage: 18}, {name: "Russia", percentage: 7}, {name: "Sweden", percentage: 4}, {name: "Other", percentage: 3}]
  Note: Canada gets 68% because hashtags contain Canadian NHL teams (torontomapleleafs, montrealcanadiens)
  
- Input: "India", hashtags: ["cricket", "ipl", "cricketlovers"] (no specific teams)
  → type: "country", locations: [{name: "India", percentage: 58}, {name: "Pakistan", percentage: 18}, {name: "Bangladesh", percentage: 12}, {name: "United Kingdom", percentage: 7}, {name: "Other", percentage: 5}]
  Note: India gets 58% (moderate boost) because it's mentioned but no specific Indian teams in hashtags`,
        },
        {
          role: 'user',
          content: `Generate demographics for:
Input: ${inputText}
Hashtags: ${hashtags.join(', ')}

IMPORTANT: Carefully analyze ALL hashtags above. Look for country-specific team names (e.g., city+team combinations like "mumbaiindians", "torontomapleleafs"). If you find country-specific teams matching the input country, that country should get 65-75%+. If the input mentions a country but hashtags are only generic sport terms, give it 55-65%.`,
        },
      ],
      functions: [
        {
          name: 'generate_demographics',
          description: 'Generate fake demographics data with top 5 locations. CRITICAL: Analyze hashtags for country-specific team indicators (e.g., "mumbaiindians" = India, "torontomapleleafs" = Canada). If country-specific teams are found, that country should get 65-75%+. If input mentions a country but hashtags are generic, give it 55-65%.',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['country', 'city'],
                description: 'Whether the breakdown is by country or city',
              },
              locations: {
                type: 'array',
                description: 'Array of exactly 5 locations with percentages. The 5th location must be "Other". Percentages must sum to 100.',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Location name (country or city)',
                    },
                    percentage: {
                      type: 'number',
                      description: 'Percentage of viewership from this location (0-100)',
                    },
                  },
                  required: ['name', 'percentage'],
                },
                minItems: 5,
                maxItems: 5,
              },
            },
            required: ['type', 'locations'],
          },
        },
      ],
      function_call: { name: 'generate_demographics' },
      temperature: 0.7,
    });

    const functionCall = response.choices[0]?.message?.function_call;
    if (!functionCall || functionCall.name !== 'generate_demographics') {
      throw new Error('OpenAI did not return demographics function call');
    }

    const rawDemographics = JSON.parse(functionCall.arguments);

    // Validate that we have exactly 5 locations and the 5th is "Other"
    if (!rawDemographics.locations || rawDemographics.locations.length !== 5) {
      throw new Error('Demographics must have exactly 5 locations');
    }

    if (rawDemographics.locations[4].name !== 'Other') {
      throw new Error('5th location must be "Other"');
    }

    // Validate percentages sum to 100 (with small tolerance for floating point)
    const totalPercentage = rawDemographics.locations.reduce(
      (sum: number, loc: DemographicsLocation) => sum + loc.percentage,
      0
    );
    if (Math.abs(totalPercentage - 100) > 0.1) {
      // Normalize to ensure it sums to 100
      const factor = 100 / totalPercentage;
      rawDemographics.locations = rawDemographics.locations.map(
        (loc: DemographicsLocation) => ({
          ...loc,
          percentage: Math.round(loc.percentage * factor * 10) / 10,
        })
      );
      // Adjust the last one to ensure exact 100
      const adjustedTotal = rawDemographics.locations
        .slice(0, 4)
        .reduce((sum: number, loc: DemographicsLocation) => sum + loc.percentage, 0);
      rawDemographics.locations[4].percentage = Math.round((100 - adjustedTotal) * 10) / 10;
    }

    return {
      type: rawDemographics.type,
      locations: rawDemographics.locations,
    };
  } catch (error) {
    console.error('Error generating demographics:', error);
    // Return default demographics on error
    return {
      type: 'country',
      locations: [
        { name: 'United States', percentage: 35 },
        { name: 'United Kingdom', percentage: 20 },
        { name: 'Canada', percentage: 15 },
        { name: 'Australia', percentage: 10 },
        { name: 'Other', percentage: 20 },
      ],
    };
  }
}

/**
 * Extract all hashtags from a campaign suggestion
 * Combines team_hashtags/character_hashtags and global_hashtags
 * Note: Hashtags already include edit variants from generation
 */
export function extractHashtagsFromSuggestion(
  suggestion: CampaignSuggestion
): string[] {
  const hashtags = new Set<string>();

  // Add global hashtags (already normalized and include edit variants)
  suggestion.global_hashtags.forEach((tag) => {
    const normalized = normalizeHashtag(tag);
    if (normalized) hashtags.add(normalized);
  });

  // Add team hashtags (sports)
  if (suggestion.teams) {
    suggestion.teams.forEach((team) => {
      team.team_hashtags.forEach((tag) => {
        const normalized = normalizeHashtag(tag);
        if (normalized) hashtags.add(normalized);
      });
    });
  }

  // Add character hashtags (media)
  if (suggestion.characters) {
    suggestion.characters.forEach((character) => {
      character.character_hashtags.forEach((tag) => {
        const normalized = normalizeHashtag(tag);
        if (normalized) hashtags.add(normalized);
      });
    });
  }

  return Array.from(hashtags);
}

