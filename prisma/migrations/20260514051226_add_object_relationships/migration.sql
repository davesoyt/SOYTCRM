-- CreateTable
CREATE TABLE "ObjectRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromObject" TEXT NOT NULL,
    "fromField" TEXT NOT NULL,
    "toObject" TEXT NOT NULL,
    "toField" TEXT NOT NULL,
    "relType" TEXT NOT NULL DEFAULT 'one_to_many',
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
