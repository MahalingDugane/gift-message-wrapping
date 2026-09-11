-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GiftSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giftMessageLabel" TEXT NOT NULL DEFAULT 'Add a free gift message',
    "giftMessagePrompt" TEXT NOT NULL DEFAULT 'Is this a gift?',
    "giftMessagePlaceholder" TEXT NOT NULL DEFAULT 'Write your personal note here (e.g. Happy Birthday Rahul! Hope you have a wonderful day! ❤️)',
    "characterLimit" INTEGER NOT NULL DEFAULT 200,
    "showCharCounter" BOOLEAN NOT NULL DEFAULT true,
    "requireToFrom" BOOLEAN NOT NULL DEFAULT false,
    "toLabel" TEXT NOT NULL DEFAULT 'To (Recipient)',
    "fromLabel" TEXT NOT NULL DEFAULT 'From (Sender)',
    "giftWrapEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giftWrapLabel" TEXT NOT NULL DEFAULT 'Add Gift Wrapping',
    "giftWrapPrice" REAL NOT NULL DEFAULT 49.00,
    "giftWrapDescription" TEXT NOT NULL DEFAULT 'Includes premium gift box and ribbon',
    "wrappingProductId" TEXT,
    "wrappingVariantId" TEXT,
    "giftWrapDesign" TEXT NOT NULL DEFAULT 'Classic Kraft',
    "defaultCardStyle" TEXT NOT NULL DEFAULT 'classic',
    "storeSignature" TEXT NOT NULL DEFAULT 'Sent with Love ❤️',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_GiftSettings" ("characterLimit", "createdAt", "defaultCardStyle", "fromLabel", "giftMessageLabel", "giftMessagePlaceholder", "giftMessagePrompt", "giftWrapDescription", "giftWrapEnabled", "giftWrapLabel", "giftWrapPrice", "id", "isEnabled", "requireToFrom", "shop", "showCharCounter", "storeSignature", "toLabel", "updatedAt", "wrappingProductId", "wrappingVariantId") SELECT "characterLimit", "createdAt", "defaultCardStyle", "fromLabel", "giftMessageLabel", "giftMessagePlaceholder", "giftMessagePrompt", "giftWrapDescription", "giftWrapEnabled", "giftWrapLabel", "giftWrapPrice", "id", "isEnabled", "requireToFrom", "shop", "showCharCounter", "storeSignature", "toLabel", "updatedAt", "wrappingProductId", "wrappingVariantId" FROM "GiftSettings";
DROP TABLE "GiftSettings";
ALTER TABLE "new_GiftSettings" RENAME TO "GiftSettings";
CREATE UNIQUE INDEX "GiftSettings_shop_key" ON "GiftSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
