import { MessageFlags } from 'discord.js';
import * as api from '../api/client.js';
import { removePlayerFromParty, getPartyByPlayer } from '../quickstart/party-session.js';

export const handler = {
  id: /^party_leave:([\w-]+)$/,
  async execute(interaction: any) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const discordId = interaction.user.id;
    const match = interaction.customId.match(/^party_leave:([\w-]+)$/);
    
    // Always fetch the current party to ensure we leave the active one,
    // ignoring any stale IDs from old buttons.
    const partyRes = await api.getMyParty(discordId);
    let fetchedPartyId = partyRes.data?.party?.id;
    
    // Fallback to button ID if API returns nothing
    if (!fetchedPartyId && match) {
        fetchedPartyId = match[1];
    }

    // Define localParty based on whatever ID we found or the user's local state
    const localParty = fetchedPartyId ? await getPartyByPlayer(discordId) : undefined;
    
    if (!fetchedPartyId) {
      // Last ditch effort: clean up any local party associated with this user
      if (localParty) {
        removePlayerFromParty(localParty.id, discordId);
        await interaction.editReply({ content: 'Forced cleanup of local party state.' });
        return;
      }
      
      await interaction.editReply({ content: 'You are not in a party.' });
      return;
    }
    
    const isLeader = localParty?.ownerId === discordId;
    
    // Leave via API
    let apiError: string | null = null;
    try {
        // The server handles disbanding if leader leaves
        await api.leaveParty(discordId, fetchedPartyId);
    } catch (e: any) {
        apiError = e.message || 'Unknown API error';
    }
    
    // Clear local state
    if (localParty) {
      if (isLeader) {
        // Leader left -> Disband entire party locally
        await interaction.channel?.send(`🚫 **${localParty.name}** has been disbanded by the leader.`);
        // Dynamically import to avoid circular dependency issues if any, though likely fine here
        const { cancelParty } = await import('../quickstart/party-session.js');
        cancelParty(localParty.id);
      } else {
        removePlayerFromParty(localParty.id, discordId);
        await interaction.channel?.send(`👋 **${interaction.user.username}** has left the party.`);
      }
    }
    
    if (apiError && !apiError.includes('not found')) {
       // Only report error if it wasn't a "not found" (which implies we are already good)
      await interaction.editReply({ content: `Left party (API warning: ${apiError})` });
      return;
    }
    
    await interaction.editReply({ content: isLeader ? '🚫 Party disbanded.' : '👋 You have left the party.' });
  },
};
