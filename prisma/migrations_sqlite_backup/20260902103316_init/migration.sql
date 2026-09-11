-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "GiftSettings" (
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
    "defaultCardStyle" TEXT NOT NULL DEFAULT 'classic',
    "storeSignature" TEXT NOT NULL DEFAULT 'Sent with Love ❤️',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftSettings_shop_key" ON "GiftSettings"("shop");
