/**
 * Game Routes
 * API endpoints for game actions: choices, combat, and outcome resolution.
 */

import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/auth.js";
import * as gameEngineService from "../services/game-engine.service.js";
import * as combatService from "../services/combat.service.js";
import * as sessionService from "../services/session.service.js";
import * as storyService from "../services/story.service.js";

const router = Router();
router.use(authMiddleware);

// ============== Choice / Voting Endpoints ==============

/**
 * POST /game/vote
 * Record a player's vote for a choice node
 */
router.post("/vote", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nodeId, choiceId } = req.body;

    if (!nodeId || !choiceId) {
      res.status(400).json({ error: "nodeId and choiceId are required" });
      return;
    }

    const session = await sessionService.getSession(user.discordId);
    if (!session) {
      res.status(404).json({ error: "No active session" });
      return;
    }

    await gameEngineService.recordPlayerVote(
      session.id,
      nodeId,
      user.discordId,
      choiceId
    );

    res.json({ message: "Vote recorded", choiceId });
  } catch (error) {
    console.error("Error recording vote:", error);
    res.status(500).json({ error: "Failed to record vote" });
  }
});

/**
 * GET /game/votes/:nodeId
 * Get vote summary for a node
 */
router.get("/votes/:nodeId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nodeId } = req.params;

    const session = await sessionService.getSession(user.discordId);
    if (!session) {
      res.status(404).json({ error: "No active session" });
      return;
    }

    if (!nodeId) {
       res.status(400).json({ error: "nodeId required" });
       return;
    }
    const summary = await gameEngineService.getVoteSummary(session.id, nodeId);
    res.json({ summary });
  } catch (error) {
    console.error("Error getting votes:", error);
    res.status(500).json({ error: "Failed to get votes" });
  }
});

/**
 * POST /game/resolve
 * Resolve outcome for a node based on votes
 */
router.post("/resolve", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nodeId, partyLeaderId } = req.body;

    if (!nodeId) {
      res.status(400).json({ error: "nodeId is required" });
      return;
    }

    const session = await sessionService.getSession(user.discordId);
    if (!session) {
      res.status(404).json({ error: "No active session" });
      return;
    }

    // Get story and node
    const story = storyService.getStory(session.storyId);
    if (!story) {
      res.status(404).json({ error: "Story not found" });
      return;
    }

    const node = story.nodes[nodeId];
    if (!node) {
      res.status(404).json({ error: "Node not found" });
      return;
    }

    // Get votes and evaluate
    const voteSummary = await gameEngineService.getVoteSummary(
      session.id,
      nodeId
    );
    const choices = node.type_specific?.choices || node.choices || [];
    const outcomeRules = node.type_specific?.outcome_rules;

    const result = gameEngineService.evaluateOutcome(
      choices,
      voteSummary,
      outcomeRules,
      partyLeaderId
    );

    // Transition to next node if we have one
    if (result.nextNodeId) {
      await gameEngineService.transitionToNode(
        user.discordId,
        result.nextNodeId,
        result.winningChoiceId || undefined
      );
    }

    // Clear votes for this node
    await gameEngineService.clearVotes(session.id, nodeId);

    res.json({
      outcome: result,
      nextNode: result.nextNodeId ? story.nodes[result.nextNodeId] : null,
    });
  } catch (error) {
    console.error("Error resolving outcome:", error);
    res.status(500).json({ error: "Failed to resolve outcome" });
  }
});

// ============== Combat Endpoints ==============

/**
 * GET /game/combat/:nodeId
 * Get current combat state
 */
router.get("/combat/:nodeId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nodeId } = req.params;

    if (!nodeId) {
      res.status(400).json({ error: "nodeId parameter is required" });
      return;
    }
    const state = await combatService.getCombatState(user.discordId, nodeId);
    res.json({ state });
  } catch (error) {
    console.error("Error getting combat state:", error);
    res.status(500).json({ error: "Failed to get combat state" });
  }
});

/**
 * POST /game/combat/action
 * Process a combat action
 */
router.post("/combat/action", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nodeId, actionId } = req.body;

    if (!nodeId || !actionId) {
      res.status(400).json({ error: "nodeId and actionId are required" });
      return;
    }

    const session = await sessionService.getSession(user.discordId);
    if (!session) {
      res.status(404).json({ error: "No active session" });
      return;
    }

    // Get combat config from story
    const story = storyService.getStory(session.storyId);
    if (!story) {
      res.status(404).json({ error: "Story not found" });
      return;
    }

    const node = story.nodes[nodeId];
    if (!node || node.type !== "combat") {
      res.status(400).json({ error: "Not a combat node" });
      return;
    }

    const combat = node.type_specific?.combat;
    if (!combat) {
      res.status(400).json({ error: "Invalid combat configuration" });
      return;
    }

    // Process the action
    const result = await combatService.processCombatAction(
      user.discordId,
      nodeId,
      actionId,
      combat
    );

    // If combat ended, transition to next node
    if (result.nextNodeId) {
      await sessionService.updateSession(user.discordId, {
        currentNodeId: result.nextNodeId,
      });
    }

    res.json({
      combatLog: result.combatLog,
      state: result.state,
      outcome: result.outcome,
      nextNodeId: result.nextNodeId,
      nextNode: result.nextNodeId ? story.nodes[result.nextNodeId] : null,
    });
  } catch (error) {
    if (error instanceof Error) {
        console.error(error.stack);
    }
    const { nodeId, actionId } = req.body;
    console.error(`[Combat] Error processing action '${actionId}' for node '${nodeId}':`, error instanceof Error ? error.message : error);
    res.status(500).json({ error: `Failed to process combat action: ${error instanceof Error ? error.message : String(error)}` });
  }
});

/**
 * POST /game/combat/init
 * Initialize combat state for a node
 */
router.post("/combat/init", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nodeId } = req.body;

    if (!nodeId) {
      res.status(400).json({ error: "nodeId is required" });
      return;
    }

    const session = await sessionService.getSession(user.discordId);
    if (!session) {
      res.status(404).json({ error: "No active session" });
      return;
    }

    const story = storyService.getStory(session.storyId);
    if (!story) {
      res.status(404).json({ error: "Story not found" });
      return;
    }

    const node = story.nodes[nodeId];
    if (!node || node.type !== "combat") {
      res.status(400).json({ error: "Not a combat node" });
      return;
    }

    const combat = node.type_specific?.combat;
    if (!combat) {
      res.status(400).json({ error: "Invalid combat configuration" });
      return;
    }

    const state = combatService.initCombatState(combat);
    await combatService.setCombatState(user.discordId, nodeId, state);

    res.json({ message: "Combat initialized", state });
  } catch (error) {
    console.error("Error initializing combat:", error);
    res.status(500).json({ error: "Failed to initialize combat" });
  }
});

// ============== Node Transition Endpoint ==============

/**
 * POST /game/transition
 * Transition to a new node (simple, non-voting choice)
 */
router.post("/transition", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nextNodeId, choiceId } = req.body;

    if (!nextNodeId) {
      res.status(400).json({ error: "nextNodeId is required" });
      return;
    }

    const result = await gameEngineService.transitionToNode(
      user.discordId,
      nextNodeId,
      choiceId
    );

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Get the new node data
    const session = await sessionService.getSession(user.discordId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const story = storyService.getStory(session.storyId);
    const node = story?.nodes[nextNodeId];

    res.json({
      message: "Transitioned to node",
      currentNodeId: nextNodeId,
      node,
    });
  } catch (error) {
    console.error("Error transitioning node:", error);
    res.status(500).json({ error: "Failed to transition" });
  }
});

export default router;
