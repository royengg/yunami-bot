/**
 * Combat Service
 * Server-side combat logic including damage calculation, enemy turns, and state management.
 * Moved from bot/src/engine/builders/combat-builder.ts and bot/src/buttonhandlers/combat-handler.ts
 */

import { prisma } from "../lib/prisma.js";

// ============== Types ==============

export interface CombatEnemy {
  id: string;
  name: string;
  hp: number;
  max_hp: number;
  damage_range: [number, number];
  image?: string;
}

export interface CombatAction {
  id: string;
  label: string;
  emoji?: string;
  style?: number;
  damage_range?: [number, number];
  defense_bonus?: number;
  dodge_chance?: number;
}

export interface CombatConfig {
  player_hp: number;
  player_max_hp?: number;
  enemies: CombatEnemy[];
  actions: CombatAction[];
  threat_level?: number;
  on_victory?: string;
  on_defeat?: string;
  on_flee?: string;
}

export interface CombatState {
  player_hp: number;
  enemies: { id: string; hp: number }[];
  defending: boolean;
  turn: number;
}

export interface CombatActionResult {
  success: boolean;
  combatLog: string[];
  state: CombatState;
  outcome?: "victory" | "defeat" | "flee" | "continue";
  nextNodeId?: string | null;
}

// ============== Combat State Management ==============

export async function getCombatState(
  odId: string,
  nodeId: string
): Promise<CombatState | null> {
  const session = await prisma.gameSession.findUnique({
    where: { odId },
  });

  if (!session) return null;

  const combatData = await prisma.combatState.findUnique({
    where: {
      sessionId_nodeId: {
        sessionId: session.id,
        nodeId,
      },
    },
  });

  if (!combatData) return null;

  return combatData.state as unknown as CombatState;
}

export async function setCombatState(
  odId: string,
  nodeId: string,
  state: CombatState
): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { odId },
  });

  if (!session) return;

  await prisma.combatState.upsert({
    where: {
      sessionId_nodeId: {
        sessionId: session.id,
        nodeId,
      },
    },
    update: { state: state as any },
    create: {
      sessionId: session.id,
      nodeId,
      state: state as any,
    },
  });
}

export async function clearCombatState(
  odId: string,
  nodeId: string
): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { odId },
  });

  if (!session) return;

  await prisma.combatState.deleteMany({
    where: {
      sessionId: session.id,
      nodeId,
    },
  });
}

// ============== Combat Logic ==============

export function initCombatState(combat: CombatConfig): CombatState {
  return {
    player_hp: combat.player_hp,
    enemies: combat.enemies.map((e) => ({ id: e.id, hp: e.hp })),
    defending: false,
    turn: 1,
  };
}

export function rollDamage(range: [number, number]): number {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function areAllEnemiesDead(state: CombatState): boolean {
  return state.enemies.every((e) => e.hp <= 0);
}

export function isPlayerDead(state: CombatState): boolean {
  return state.player_hp <= 0;
}

// ============== Combat Action Processing ==============

export async function processCombatAction(
  odId: string,
  nodeId: string,
  actionId: string,
  combat: CombatConfig
): Promise<CombatActionResult> {
  let state = await getCombatState(odId, nodeId);

  if (!state) {
    state = initCombatState(combat);
  }

  state.defending = false;
  const combatLog: string[] = [];

  console.log(`[CombatService] Processing action ${actionId} for node ${nodeId}. State found: ${!!state}`);
  
  const action = combat.actions.find((a) => a.id === actionId);
  if (!action) {
    console.warn(`[CombatService] Action ${actionId} not found in config! Available: ${combat.actions.map(a => a.id).join(', ')}`);
  }

  // Handle flee
  if (actionId === "flee" || action?.id === "flee") {
    if (combat.on_flee) {
      await clearCombatState(odId, nodeId);
      return {
        success: true,
        combatLog: ["You fled from combat!"],
        state,
        outcome: "flee",
        nextNodeId: combat.on_flee,
      };
    }
    combatLog.push("You attempted to flee but there's no escape!");
  }
  // Handle attack
  else if (action?.damage_range) {
    const targetEnemy = state.enemies.find((e) => e.hp > 0);
    if (targetEnemy) {
      const damage = rollDamage(action.damage_range);
      targetEnemy.hp = Math.max(0, targetEnemy.hp - damage);
      const enemyConfig = combat.enemies.find((e) => e.id === targetEnemy.id);
      combatLog.push(
        `You dealt **${damage}** damage to **${enemyConfig?.name || targetEnemy.id}**!`
      );
    }
  }
  // Handle defend
  else if (action?.defense_bonus) {
    state.defending = true;
    combatLog.push(
      `You take a defensive stance! (Defense +${action.defense_bonus})`
    );
  }
  // Handle dodge prep
  else if (action?.dodge_chance) {
    combatLog.push(
      `You prepare to dodge the next attack! (${action.dodge_chance}% chance)`
    );
  }

  // Check victory
  if (areAllEnemiesDead(state)) {
    await clearCombatState(odId, nodeId);
    combatLog.push("\n**Victory!** All enemies defeated!");
    return {
      success: true,
      combatLog,
      state,
      outcome: "victory",
      nextNodeId: combat.on_victory || null,
    };
  }

  // Process enemy turn if combat continues
  if (!areAllEnemiesDead(state)) {
    const enemyLog = processEnemyTurn(state, combat, action);
    combatLog.push(...enemyLog);
  }

  // Check defeat
  if (isPlayerDead(state)) {
    await clearCombatState(odId, nodeId);
    combatLog.push("\n**Defeated!** You have fallen in combat.");
    return {
      success: true,
      combatLog,
      state,
      outcome: "defeat",
      nextNodeId: combat.on_defeat || null,
    };
  }

  // Combat continues
  state.turn += 1;
  await setCombatState(odId, nodeId, state);

  return {
    success: true,
    combatLog,
    state,
    outcome: "continue",
  };
}

function processEnemyTurn(
  state: CombatState,
  combat: CombatConfig,
  playerAction?: CombatAction
): string[] {
  const log: string[] = [];

  for (const enemyState of state.enemies) {
    if (enemyState.hp <= 0) continue;

    const enemyConfig = combat.enemies.find((e) => e.id === enemyState.id);
    if (!enemyConfig) continue;

    let damage = rollDamage(enemyConfig.damage_range);
    const enemyName = enemyConfig.name;

    // Check dodge
    if (playerAction?.dodge_chance) {
      const dodgeRoll = Math.random() * 100;
      if (dodgeRoll < playerAction.dodge_chance) {
        log.push(`**${enemyName}** attacked but you dodged!`);
        continue;
      }
    }

    // Apply defense reduction
    if (state.defending && playerAction?.defense_bonus) {
      damage = Math.max(1, damage - playerAction.defense_bonus);
    }

    state.player_hp = Math.max(0, state.player_hp - damage);
    log.push(`**${enemyName}** dealt **${damage}** damage to you!`);
  }

  return log;
}
