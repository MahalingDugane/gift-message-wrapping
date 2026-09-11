-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
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
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giftMessagePrompt" TEXT NOT NULL DEFAULT 'Add a gift message',
    "giftMessageLabel" TEXT NOT NULL DEFAULT 'Message',
    "giftMessagePlaceholder" TEXT NOT NULL DEFAULT 'Happy Birthday, Rahul! ❤️',
    "characterLimit" INTEGER NOT NULL DEFAULT 200,
    "showCharCounter" BOOLEAN NOT NULL DEFAULT true,
    "requireToFrom" BOOLEAN NOT NULL DEFAULT true,
    "toLabel" TEXT NOT NULL DEFAULT 'To (Recipient)',
    "fromLabel" TEXT NOT NULL DEFAULT 'From (Sender)',
    "giftWrapEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giftWrapLabel" TEXT NOT NULL DEFAULT 'Add Premium Gift Box',
    "wrappingProductId" TEXT,
    "defaultCardStyle" TEXT NOT NULL DEFAULT 'classic',
    "storeSignature" TEXT NOT NULL DEFAULT 'Sent with Love ❤️',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftWrappingDesign" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT DEFAULT 'Includes luxury wrapping',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "imageUrl" TEXT,
    "variantId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftWrappingDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftSettings_shop_key" ON "GiftSettings"("shop");

-- CreateIndex
CREATE INDEX "GiftWrappingDesign_shop_idx" ON "GiftWrappingDesign"("shop");

-- AddForeignKey
ALTER TABLE "GiftWrappingDesign" ADD CONSTRAINT "GiftWrappingDesign_shop_fkey" FOREIGN KEY ("shop") REFERENCES "GiftSettings"("shop") ON DELETE CASCADE ON UPDATE CASCADE;
