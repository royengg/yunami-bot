/**
 * Game Engine Service
 * Core server-side logic for story progression, voting, and outcome evaluation.
 * Moved from bot/src/engine/outcome-engine.ts
 */

import { prisma } from "../lib/prisma.js";
import * as storyService from "./story.service.js";

// ============== Types ==============

export interface PlayerInput {
  playerId: string;
  choiceId?: string;
  selectValues?: string[];
  roleAction?: string;
  timestamp: Date;
}

export interface VoteSummary {
  totalVotes: number;
  voteCounts: Record<string, number>;
  voters: Record<string, string[]>;
  playerChoices: Record<string, string>;
  timedOut: boolean;
}

export interface OutcomeResult {
  nextNodeId: string | null;
  stateChanges?: StateChange[];
  message?: string;
  winningChoiceId?: string | null;
}

export interface StateChange {
  type: "flag" | "resource" | "item";
  key: string;
  value: any;
}

export interface Choice {
  id: string;
  label: string;
  nextNodeId: string | null;
  [key: string]: any;
}

// ============== Vote Management ==============

export async function recordPlayerVote(
  sessionId: string,
  nodeId: string,
  playerId: string,
  choiceId: string
): Promise<void> {
  await prisma.nodeVote.upsert({
    where: {
      sessionId_nodeId_playerId: {
        sessionId,
        nodeId,
        playerId,
      },
    },
    update: {
      choiceId,
      votedAt: new Date(),
    },
    create: {
      sessionId,
      nodeId,
      playerId,
      choiceId,
      votedAt: new Date(),
    },
  });
}

export async function getVoteSummary(
  sessionId: string,
  nodeId: string
): Promise<VoteSummary> {
  const votes = await prisma.nodeVote.findMany({
    where: { sessionId, nodeId },
  });

  const voteCounts: Record<string, number> = {};
  const voters: Record<string, string[]> = {};
  const playerChoices: Record<string, string> = {};

  for (const vote of votes) {
    voteCounts[vote.choiceId] = (voteCounts[vote.choiceId] || 0) + 1;
    let list = voters[vote.choiceId];
    if (!list) {
      list = [];
      voters[vote.choiceId] = list;
    }
    list.push(vote.playerId);
    playerChoices[vote.playerId] = vote.choiceId;
  }

  // Check if timed out (via timer table)
  const timer = await prisma.timer.findFirst({
    where: {
      session: { id: sessionId },
      nodeId,
    },
  });
  const timedOut = timer ? new Date() > timer.expiresAt : false;

  return {
    totalVotes: votes.length,
    voteCounts,
    voters,
    playerChoices,
    timedOut,
  };
}

export async function clearVotes(
  sessionId: string,
  nodeId: string
): Promise<void> {
  await prisma.nodeVote.deleteMany({
    where: { sessionId, nodeId },
  });
}

// ============== Outcome Evaluation ==============

export function evaluateOutcome(
  choices: Choice[],
  voteSummary: VoteSummary,
  outcomeRules?: { compute?: string },
  partyLeaderId?: string
): OutcomeResult {
  const ruleSet = outcomeRules?.compute || "majority";

  switch (ruleSet) {
    case "majority":
      return evaluateSimpleMajority(choices, voteSummary, partyLeaderId);
    case "first":
      return evaluateFirst(choices, voteSummary);
    case "last":
      return evaluateLast(choices, voteSummary);
    case "random":
      return evaluateRandom(choices, voteSummary);
    default:
      return evaluateSimpleMajority(choices, voteSummary, partyLeaderId);
  }
}

function evaluateSimpleMajority(
  choices: Choice[],
  voteSummary: VoteSummary,
  partyLeaderId?: string
): OutcomeResult {
  const { voteCounts, playerChoices, timedOut } = voteSummary;

  if (timedOut && Object.keys(voteCounts).length === 0) {
    return {
      nextNodeId: null,
      message: "Time expired with no votes",
    };
  }

  // Find max votes and tied choices
  let maxVotes = 0;
  const tiedChoiceIds: string[] = [];

  for (const [choiceId, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      tiedChoiceIds.length = 0;
      tiedChoiceIds.push(choiceId);
    } else if (count === maxVotes) {
      tiedChoiceIds.push(choiceId);
    }
  }

  let winningChoiceId: string | null = tiedChoiceIds[0] ?? null;

  // Tiebreaker: party leader's vote
  if (tiedChoiceIds.length > 1 && partyLeaderId) {
    const leaderVote = playerChoices[partyLeaderId];
    if (leaderVote && tiedChoiceIds.includes(leaderVote)) {
      winningChoiceId = leaderVote;
    }
  }

  const winningChoice = choices.find((c) => c.id === winningChoiceId);
  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  return {
    nextNodeId: winningChoice?.nextNodeId ?? null,
    winningChoiceId,
    message:
      tiedChoiceIds.length > 1 && winningChoiceId
        ? `Leader decided: ${winningChoice?.label}`
        : totalVotes > 1 && winningChoiceId
          ? `Majority chose: ${winningChoice?.label}`
          : undefined,
  };
}

function evaluateFirst(
  choices: Choice[],
  voteSummary: VoteSummary
): OutcomeResult {
  // Server doesn't track exact timestamps per vote in this simple model
  // Default to first choice in voteCounts
  const firstChoiceId = Object.keys(voteSummary.voteCounts)[0];
  const choice = choices.find((c) => c.id === firstChoiceId);

  return {
    nextNodeId: choice?.nextNodeId ?? null,
    winningChoiceId: firstChoiceId,
    message:
      voteSummary.totalVotes > 1 ? `First choice: ${choice?.label}` : undefined,
  };
}

function evaluateLast(
  choices: Choice[],
  voteSummary: VoteSummary
): OutcomeResult {
  const choiceIds = Object.keys(voteSummary.voteCounts);
  const lastChoiceId = choiceIds[choiceIds.length - 1];
  const choice = choices.find((c) => c.id === lastChoiceId);

  return {
    nextNodeId: choice?.nextNodeId ?? null,
    winningChoiceId: lastChoiceId,
    message:
      voteSummary.totalVotes > 1 ? `Last choice: ${choice?.label}` : undefined,
  };
}

function evaluateRandom(
  choices: Choice[],
  voteSummary: VoteSummary
): OutcomeResult {
  const choiceIds = Object.keys(voteSummary.voteCounts);
  if (choiceIds.length === 0) {
    return { nextNodeId: null };
  }

  const randomId = choiceIds[Math.floor(Math.random() * choiceIds.length)];
  const choice = choices.find((c) => c.id === randomId);

  return {
    nextNodeId: choice?.nextNodeId ?? null,
    winningChoiceId: randomId,
    message:
      voteSummary.totalVotes > 1
        ? `Random selection: ${choice?.label}`
        : undefined,
  };
}

// ============== Session State Transitions ==============

export async function transitionToNode(
  odId: string,
  nextNodeId: string,
  previousChoice?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await prisma.gameSession.findUnique({
    where: { odId },
  });

  if (!session) {
    return { success: false, error: "No active session" };
  }

  const story = storyService.getStory(session.storyId);
  if (!story) {
    return { success: false, error: "Story not found" };
  }

  const node = story.nodes[nextNodeId];
  if (!node) {
    return { success: false, error: `Node ${nextNodeId} not found` };
  }

  // Update session with new node
  const updatedChoices = previousChoice
    ? [...(session.choices as string[]), previousChoice]
    : (session.choices as string[]);

  await prisma.gameSession.update({
    where: { odId },
    data: {
      currentNodeId: nextNodeId,
      choices: updatedChoices,
    },
  });

  return { success: true };
}
