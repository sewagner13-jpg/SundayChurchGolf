"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface FormatFormData {
  name: string;
  description: string;
}

export async function createFormat(data: FormatFormData) {
  const format = await prisma.format.create({
    data: {
      name: data.name,
      description: data.description,
    },
  });

  revalidatePath("/formats");
  return format;
}

export async function updateFormat(id: string, data: FormatFormData) {
  const format = await prisma.format.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
    },
  });

  revalidatePath("/formats");
  return format;
}

export async function deleteFormat(id: string) {
  // Check if format has been used in a round
  const usedInRound = await prisma.round.findFirst({
    where: { formatId: id },
  });

  if (usedInRound) {
    throw new Error("Cannot delete format that has been used in rounds.");
  }

  await prisma.format.delete({ where: { id } });
  revalidatePath("/formats");
}

export async function listFormats() {
  return prisma.format.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getFormat(id: string) {
  return prisma.format.findUnique({
    where: { id },
  });
}
