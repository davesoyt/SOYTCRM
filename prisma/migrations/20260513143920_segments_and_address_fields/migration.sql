-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "city" TEXT;
ALTER TABLE "Contact" ADD COLUMN "country" TEXT;
ALTER TABLE "Contact" ADD COLUMN "lat" REAL;
ALTER TABLE "Contact" ADD COLUMN "lng" REAL;
ALTER TABLE "Contact" ADD COLUMN "state" TEXT;
ALTER TABLE "Contact" ADD COLUMN "street" TEXT;
ALTER TABLE "Contact" ADD COLUMN "zip" TEXT;

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filtersJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
