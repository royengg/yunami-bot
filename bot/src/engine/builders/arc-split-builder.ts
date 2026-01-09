import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import type { StoryNode, BuilderResult, ArcDefinition } from '../types.js';
import type { MultiplayerSession } from '../../types/party.js';
import { getPartyRole } from '../../quickstart/runtime-graph.js';

export interface ArcSplitContext {
  playerId: string;
  party: MultiplayerSession | null;
  nodeId: string;
}

export interface ArcSplitResult extends BuilderResult {
  roleInfo?: Map<string, string>; // role -> private info (for DM delivery)
}

/**
 * Arc-split in shared screen mode:
 * - Everyone sees the same screen with role assignments
 * - DM deliveries send private info to specific roles (via side_effects)
 * - Only leader can press Continue to proceed
 * - No separate paths - everyone stays on the same story track
 */
export async function buildArcSplitNode(
  node: StoryNode,
  context: ArcSplitContext
): Promise<ArcSplitResult> {
  const publicEmbed = node.public_embed;
  const arcSplitConfig = node.type_specific?.arc_split;
  
  if (!context.party) {
    throw new Error('arc_split requires a party (multiplayer)');
  }

  const embed = new EmbedBuilder()
    .setColor(publicEmbed?.color ?? 0x9b59b6);
  
  if (publicEmbed?.title) embed.setTitle(publicEmbed.title);
  else if (node.title) embed.setTitle(node.title);
  else embed.setTitle('📋 Mission Briefing');
  
  let description = publicEmbed?.description || 'Your team receives their assignments...';
  
  // Show role assignments if arc config exists
  if (arcSplitConfig?.arcs) {
    description += '\n\n**Assignments:**\n';
    
    for (const arc of arcSplitConfig.arcs) {
      // Find players with required roles for this arc
      const assignedPlayers = context.party.players.filter(p => {
        const playerRole = (p.role || getPartyRole(p.odId))?.toLowerCase().trim();
        const requiredRoles = arc.required_roles?.map(r => r.toLowerCase().trim()) || [];
        return requiredRoles.includes(playerRole || '');
      });
      
      if (assignedPlayers.length > 0) {
        const playerNames = assignedPlayers.map(p => p.username).join(', ');
        description += `\n**${arc.label}**\n`;
        description += `> ${playerNames}\n`;
        if (arc.description) {
          description += `> *${arc.description}*\n`;
        }
      }
    }
  }
  
  embed.setDescription(description);
  
  if (publicEmbed?.footer) {
    embed.setFooter({ text: publicEmbed.footer });
  } else {
    embed.setFooter({ text: 'Private briefings have been sent to team members' });
  }

  // Get next node from the config
  const nextNodeId = arcSplitConfig?.merge_node_id || node.type_specific?.extra_data?.nextNodeId;
  let components: ActionRowBuilder<ButtonBuilder>[] | null = null;

  // In Shared Screen mode (active party), the button must be visible to everyone.
  // The handler (engine-continue.ts) enforces that only the leader can actually use it.
  // If we hide it here based on context.playerId, a re-render triggered by a non-leader will hide it for everyone.
  let showButton = true;
  
  // Debug log to confirm build context
  if (context.party && context.party.status === 'active') {
    showButton = true;
  }

  if (nextNodeId && showButton) {
    components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`engine:continue:${nextNodeId}`)
          .setLabel('Continue')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
      ),
    ];
  }

  return {
    embed,
    components,
  };
}

export function formatArcInfo(arc: ArcDefinition, playerCount: number): string {
  const parts = [arc.label];
  if (arc.description) {
    parts.push(`*${arc.description}*`);
  }
  parts.push(`Players: ${playerCount}`);
  if (arc.required_roles?.length) {
    parts.push(`Requires: ${arc.required_roles.join(', ')}`);
  }
  return parts.join('\n');
}

