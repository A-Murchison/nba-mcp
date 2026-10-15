import type { Team } from "../domain/models.js";

interface NbaTeamDefinition {
  numericId: string;
  abbreviation: string;
  name: string;
  city: string;
  aliases?: string[];
}

const DEFINITIONS: NbaTeamDefinition[] = [
  { numericId: "1610612737", abbreviation: "ATL", city: "Atlanta", name: "Atlanta Hawks" },
  { numericId: "1610612738", abbreviation: "BOS", city: "Boston", name: "Boston Celtics" },
  { numericId: "1610612751", abbreviation: "BKN", city: "Brooklyn", name: "Brooklyn Nets" },
  { numericId: "1610612766", abbreviation: "CHA", city: "Charlotte", name: "Charlotte Hornets" },
  { numericId: "1610612741", abbreviation: "CHI", city: "Chicago", name: "Chicago Bulls" },
  { numericId: "1610612739", abbreviation: "CLE", city: "Cleveland", name: "Cleveland Cavaliers", aliases: ["Cavs"] },
  { numericId: "1610612742", abbreviation: "DAL", city: "Dallas", name: "Dallas Mavericks", aliases: ["Mavs"] },
  { numericId: "1610612743", abbreviation: "DEN", city: "Denver", name: "Denver Nuggets" },
  { numericId: "1610612765", abbreviation: "DET", city: "Detroit", name: "Detroit Pistons" },
  { numericId: "1610612744", abbreviation: "GSW", city: "Golden State", name: "Golden State Warriors", aliases: ["Warriors"] },
  { numericId: "1610612745", abbreviation: "HOU", city: "Houston", name: "Houston Rockets" },
  { numericId: "1610612754", abbreviation: "IND", city: "Indiana", name: "Indiana Pacers" },
  { numericId: "1610612746", abbreviation: "LAC", city: "Los Angeles", name: "Los Angeles Clippers", aliases: ["LA Clippers"] },
  { numericId: "1610612747", abbreviation: "LAL", city: "Los Angeles", name: "Los Angeles Lakers", aliases: ["LA Lakers"] },
  { numericId: "1610612763", abbreviation: "MEM", city: "Memphis", name: "Memphis Grizzlies" },
  { numericId: "1610612748", abbreviation: "MIA", city: "Miami", name: "Miami Heat" },
  { numericId: "1610612749", abbreviation: "MIL", city: "Milwaukee", name: "Milwaukee Bucks" },
  { numericId: "1610612750", abbreviation: "MIN", city: "Minnesota", name: "Minnesota Timberwolves", aliases: ["Wolves"] },
  { numericId: "1610612740", abbreviation: "NOP", city: "New Orleans", name: "New Orleans Pelicans" },
  { numericId: "1610612752", abbreviation: "NYK", city: "New York", name: "New York Knicks" },
  { numericId: "1610612760", abbreviation: "OKC", city: "Oklahoma City", name: "Oklahoma City Thunder", aliases: ["Thunder"] },
  { numericId: "1610612753", abbreviation: "ORL", city: "Orlando", name: "Orlando Magic" },
  { numericId: "1610612755", abbreviation: "PHI", city: "Philadelphia", name: "Philadelphia 76ers", aliases: ["Sixers"] },
  { numericId: "1610612756", abbreviation: "PHX", city: "Phoenix", name: "Phoenix Suns" },
  { numericId: "1610612757", abbreviation: "POR", city: "Portland", name: "Portland Trail Blazers", aliases: ["Blazers"] },
  { numericId: "1610612758", abbreviation: "SAC", city: "Sacramento", name: "Sacramento Kings" },
  { numericId: "1610612759", abbreviation: "SAS", city: "San Antonio", name: "San Antonio Spurs" },
  { numericId: "1610612761", abbreviation: "TOR", city: "Toronto", name: "Toronto Raptors" },
  { numericId: "1610612762", abbreviation: "UTA", city: "Utah", name: "Utah Jazz" },
  { numericId: "1610612764", abbreviation: "WAS", city: "Washington", name: "Washington Wizards" },
];

export const NBA_TEAMS: readonly NbaTeamDefinition[] = DEFINITIONS;

const byIdentifier = new Map(
  DEFINITIONS.flatMap((team) => [[team.numericId, team], [team.abbreviation, team]]),
);

export function nbaTeam(teamId: string): NbaTeamDefinition | undefined {
  return byIdentifier.get(teamId.trim().toUpperCase());
}

export function canonicalNbaTeam(teamId: string): Team | undefined {
  const team = nbaTeam(teamId);
  return team && { id: team.numericId, abbreviation: team.abbreviation, name: team.name, city: team.city };
}

export function searchNbaTeams(query: string): Team[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return DEFINITIONS
    .filter((team) => [team.numericId, team.abbreviation, team.name, team.city, ...(team.aliases ?? [])]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    .map((team) => ({ id: team.numericId, abbreviation: team.abbreviation, name: team.name, city: team.city }));
}
