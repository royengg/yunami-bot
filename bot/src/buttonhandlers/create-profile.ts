<<<<<<< HEAD
import { initSession, setActiveMessage } from '../quickstart/runtime-graph.js';
import { storyGraph } from '../quickstart/story-graph.js';
import { renderNode } from '../engine/dispatcher.js';
import { initPrologueEvaluation } from '../engine/prologue-evaluator.js';
=======
import { storySceneBuilder } from '../quickstart/embed-builder.js';
import { initSession } from '../quickstart/runtime-graph.js';
import * as api from '../api/client.js';
>>>>>>> 2689533 (linking frontend with backend and doing computation in the backend)

export const handler = {
  id: 'createProfile',
  async execute(interaction: any) {
    const discordId = interaction.user.id;
    const username = interaction.user.username;

    try {
      if (interaction.customId === 'createProfile') {
        await interaction.deferUpdate();

        // Register user with backend (or get existing)
        const registerResult = await api.register(discordId, username);
        // Ignore error if user already exists

        // Start prologue via backend
        const prologueResult = await api.startPrologue(discordId);
        if (prologueResult.error) {
          await interaction.editReply({
            content: `Error: ${prologueResult.error}`,
            components: [],
          });
          return;
        }

<<<<<<< HEAD
        initSession(odId, data.id, data.firstNodeId, data);
        initPrologueEvaluation(odId);

        await interaction.deferUpdate();

        const firstNode = data.nodes[data.firstNodeId];
        if (!firstNode) {
          console.error('First node not found:', data.firstNodeId);
          return;
=======
        // Fetch prologue story from backend
        const storyResponse = await api.getStory(discordId, 'prologue_1');
        if (storyResponse.error || !storyResponse.data?.story) {
          await interaction.editReply({
            content: 'Prologue story not found.',
            components: [],
          });
          return;
        }

        const storyData = storyResponse.data.story;
        const progress = prologueResult.data?.progress;
        const startNodeId = progress?.currentNodeId || storyData.firstNodeId;

        // Initialize local session for rendering
        initSession(discordId, storyData.id, startNodeId, storyData);

        const [cutsceneEmbed, choicesButton, cutsceneImage] =
          await storySceneBuilder(startNodeId, storyData);

        const payload: any = {
          embeds: [cutsceneEmbed],
          components: choicesButton ? [choicesButton] : [],
        };
        if (cutsceneImage) {
          payload.files = [cutsceneImage];
>>>>>>> 2689533 (linking frontend with backend and doing computation in the backend)
        }

        const nextNodeId = firstNode.type_specific?.extra_data?.nextNodeId;
        const result = await renderNode(firstNode, nextNodeId);
        const payload: any = {
          embeds: [result.embed],
          components: result.components ?? [],
        };
        if (result.attachment) {
          payload.files = [result.attachment];
        }

        const reply = await interaction.editReply(payload);
        setActiveMessage(odId, reply.channelId, reply.id);
        return;
      }
    } catch (error) {
      console.error(error);
    }
  },
};
