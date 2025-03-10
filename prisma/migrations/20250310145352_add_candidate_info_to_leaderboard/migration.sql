/*
  Warnings:

  - Added the required column `candidateEmail` to the `Leaderboard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `candidateName` to the `Leaderboard` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Leaderboard" ADD COLUMN     "candidateEmail" TEXT NOT NULL,
ADD COLUMN     "candidateName" TEXT NOT NULL;
