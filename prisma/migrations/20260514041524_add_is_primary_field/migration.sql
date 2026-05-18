-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectType" TEXT,
    "customObjectDefId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "selectOptions" TEXT NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldDefinition_customObjectDefId_fkey" FOREIGN KEY ("customObjectDefId") REFERENCES "CustomObjectDef" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FieldDefinition" ("createdAt", "customObjectDefId", "fieldType", "id", "isBuiltIn", "key", "label", "objectType", "order", "required", "selectOptions") SELECT "createdAt", "customObjectDefId", "fieldType", "id", "isBuiltIn", "key", "label", "objectType", "order", "required", "selectOptions" FROM "FieldDefinition";
DROP TABLE "FieldDefinition";
ALTER TABLE "new_FieldDefinition" RENAME TO "FieldDefinition";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
