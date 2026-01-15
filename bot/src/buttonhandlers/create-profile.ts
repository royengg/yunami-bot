import { initSession, setActiveMessage } from '../quickstart/runtime-graph.js';
import { MessageFlags } from 'discord.js';
import { storyGraph } from '../quickstart/story-graph.js';
import { renderNode } from '../engine/dispatcher.js';
import { initPrologueEvaluation, restoreFromChoices } from '../engine/prologue-evaluator.js';
import * as api from '../api/client.js';

export const handler = {
  id: 'createProfile',
  async execute(interaction: any) {
    const odId = interaction.user.id;
    try {
      const data = storyGraph.getStory('prologue_1');
      if (!data) {
        console.error('Prologue not found');
        await interaction.reply({ content: 'Prologue story not found.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferUpdate();
      const response = await api.startPrologue(odId);
      if (response.error) {
       if (response.error.includes('already completed')) {
           await interaction.editReply({ 
             content: 'You already have a profile! Use `/profile` to view it.',
             embeds: [],
             components: []
           });
           return;
         }
         console.error('API Error:', response.error);
         await interaction.editReply({ content: 'Failed to start prologue. Please try again.' });
         return;
      }
      const progress = response.data?.progress;
      const startNodeId = progress?.currentNodeId || data.firstNodeId;
      initSession(odId, data.id, startNodeId, data);
      if (progress?.state?.choices) {
          restoreFromChoices(odId, progress.state.choices, data.traitMappings || {});
      } else {
          initPrologueEvaluation(odId);
      }
      
      const currentNode = data.nodes[startNodeId];
      if (!currentNode) {
        console.error('Node not found:', startNodeId);
        await interaction.editReply({ content: `Error: Node "${startNodeId}" not found in prologue.` });
        return;
      }
      const result = await renderNode(currentNode);
      const payload: any = {
        embeds: [result.embed],
        components: result.components ?? [],
      };
      if (result.attachment) {
        payload.files = [result.attachment];
      }
      
      // Update the ephemeral "Create Profile" message to indicate success
      await interaction.editReply({ 
        content: '✅ Profile created! Your story begins below.',
        embeds: [],
        components: []
      });

      // Send the prologue as a new PUBLIC message
      const publicReply = await interaction.followUp({
        ...payload,
        ephemeral: false
      });

      setActiveMessage(odId, publicReply.channelId, publicReply.id);
    } catch (error) {
      console.error(error);
    }
  },
};
