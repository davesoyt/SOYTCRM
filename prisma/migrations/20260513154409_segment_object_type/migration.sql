-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Segment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objectType" TEXT NOT NULL DEFAULT 'contact',
    "filtersJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Segment" ("createdAt", "description", "filtersJson", "id", "name", "updatedAt") SELECT "createdAt", "description", "filtersJson", "id", "name", "updatedAt" FROM "Segment";
DROP TABLE "Segment";
ALTER TABLE "new_Segment" RENAME TO "Segment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
