import { fetchTeams } from '../api/teams';
import type { TemplateNode } from '../data/templates';

export async function resolveTemplateTeamKeys(nodes: TemplateNode[]): Promise<TemplateNode[]> {
  try {
    const teams = await fetchTeams({ active: true });
    const teamMap = new Map(teams.map((t) => [t.key, t.id]));

    return nodes.map((node) => {
      const config: Record<string, unknown> = { ...node.config };

      const resolveKey = (key: string, targetKey: string) => {
        const teamKey = config[key];
        if (typeof teamKey === 'string' && teamMap.has(teamKey)) {
          config[targetKey] = teamMap.get(teamKey);
          delete config[key];
        }
      };

      resolveKey('assignedTeamKey', 'assignedTeamId');
      resolveKey('requestedFromTeamKey', 'requestedFromTeamId');
      resolveKey('toTeamKey', 'toTeamId');

      return { ...node, config };
    });
  } catch {
    return nodes;
  }
}
