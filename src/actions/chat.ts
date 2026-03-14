"use server";

import { prisma } from "@/lib/db";

const MAX_MESSAGE_LENGTH = 280;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function normalizeBody(body: string) {
  return body.trim().replace(/\s+/g, " ");
}

function getApproximateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.floor((base64.length * 3) / 4);
}

function validateImagePayload(image?: {
  dataUrl: string;
  mimeType: string;
  fileName: string;
}) {
  if (!image) return;

  if (!image.dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image payload");
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
    throw new Error("Only JPG, PNG, WEBP, and HEIC images are allowed");
  }

  if (getApproximateDataUrlBytes(image.dataUrl) > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 2MB or smaller");
  }
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
      imageDataUrl: message.imageDataUrl,
      imageName: message.imageName,
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
          imageDataUrl: pendingImportantMessage.imageDataUrl,
          imageName: pendingImportantMessage.imageName,
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
  isImportant: boolean,
  image?: {
    dataUrl: string;
    mimeType: string;
    fileName: string;
  }
) {
  const normalizedBody = normalizeBody(body);
  validateImagePayload(image);

  if (!normalizedBody && !image) {
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
      imageDataUrl: image?.dataUrl,
      imageMimeType: image?.mimeType,
      imageName: image?.fileName,
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
    imageDataUrl: message.imageDataUrl,
    imageName: message.imageName,
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
