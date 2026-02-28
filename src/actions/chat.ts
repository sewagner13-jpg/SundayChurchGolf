"use server";

import { prisma } from "@/lib/db";

const MAX_MESSAGE_LENGTH = 280;

function normalizeBody(body: string) {
  return body.trim().replace(/\s+/g, " ");
}

export async function getRoundChat(roundId: string, teamId?: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      teams: {
        select: {
          id: true,
          teamNumber: true,
        },
      },
    },
  });

  if (!round) {
    throw new Error("Round not found");
  }

  if (teamId && !round.teams.some((team) => team.id === teamId)) {
    throw new Error("Team not found for this round");
  }

  const messages = await prisma.roundMessage.findMany({
    where: { roundId },
    orderBy: { createdAt: "asc" },
    include: {
      senderTeam: {
        select: { id: true, teamNumber: true },
      },
      acknowledgements: teamId
        ? {
            where: { teamId },
            select: { teamId: true },
          }
        : false,
    },
  });

  const pendingImportantMessage = teamId
    ? await prisma.roundMessage.findFirst({
        where: {
          roundId,
          isImportant: true,
          acknowledgements: {
            none: { teamId },
          },
        },
        orderBy: { createdAt: "asc" },
        include: {
          senderTeam: {
            select: { id: true, teamNumber: true },
          },
        },
      })
    : null;

  return {
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      isImportant: message.isImportant,
      createdAt: message.createdAt.toISOString(),
      senderTeamId: message.senderTeamId,
      senderTeamNumber: message.senderTeam.teamNumber,
      acknowledgedByCurrentTeam: teamId
        ? Array.isArray(message.acknowledgements) &&
          message.acknowledgements.length > 0
        : false,
    })),
    pendingImportantMessage: pendingImportantMessage
      ? {
          id: pendingImportantMessage.id,
          body: pendingImportantMessage.body,
          createdAt: pendingImportantMessage.createdAt.toISOString(),
          senderTeamNumber: pendingImportantMessage.senderTeam.teamNumber,
        }
      : null,
  };
}

export async function postRoundMessage(
  roundId: string,
  senderTeamId: string,
  body: string,
  isImportant: boolean
) {
  const normalizedBody = normalizeBody(body);

  if (!normalizedBody) {
    throw new Error("Message cannot be empty");
  }

  if (normalizedBody.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or less`);
  }

  const team = await prisma.team.findFirst({
    where: {
      id: senderTeamId,
      roundId,
    },
    select: {
      id: true,
      roundId: true,
    },
  });

  if (!team) {
    throw new Error("Team not found for this round");
  }

  const message = await prisma.roundMessage.create({
    data: {
      roundId,
      senderTeamId,
      body: normalizedBody,
      isImportant,
      acknowledgements: isImportant
        ? {
            create: {
              teamId: senderTeamId,
            },
          }
        : undefined,
    },
    include: {
      senderTeam: {
        select: { teamNumber: true },
      },
    },
  });

  return {
    id: message.id,
    body: message.body,
    isImportant: message.isImportant,
    createdAt: message.createdAt.toISOString(),
    senderTeamNumber: message.senderTeam.teamNumber,
  };
}

export async function acknowledgeImportantMessage(
  roundId: string,
  teamId: string,
  messageId: string
) {
  const message = await prisma.roundMessage.findFirst({
    where: {
      id: messageId,
      roundId,
      isImportant: true,
    },
    select: {
      id: true,
    },
  });

  if (!message) {
    throw new Error("Important message not found");
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      roundId,
    },
    select: { id: true },
  });

  if (!team) {
    throw new Error("Team not found for this round");
  }

  await prisma.roundMessageAcknowledgement.upsert({
    where: {
      roundMessageId_teamId: {
        roundMessageId: messageId,
        teamId,
      },
    },
    create: {
      roundMessageId: messageId,
      teamId,
    },
    update: {},
  });
}
