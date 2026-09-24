import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await prisma.giftSettings.findUnique({
    where: { shop },
  });

  return { settings };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  try {
    const isEnabled = formData.get("isEnabled") === "true";
    const giftWrapEnabled = formData.get("giftWrapEnabled") === "true";
    const giftMessagePrompt = String(formData.get("giftMessagePrompt") || "").trim() || "Add a gift message";
    const giftWrapLabel = String(formData.get("giftWrapLabel") || "").trim() || "Add Premium Gift Wrapping";
    const rawLimit = parseInt(formData.get("characterLimit"), 10);
    const characterLimit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : 250;

    await prisma.giftSettings.upsert({
      where: { shop },
      create: {
        shop,
        isEnabled,
        giftWrapEnabled,
        giftMessagePrompt,
        giftWrapLabel,
        characterLimit,
      },
      update: {
        isEnabled,
        giftWrapEnabled,
        giftMessagePrompt,
        giftWrapLabel,
        characterLimit,
      },
    });

    return { success: true };
  } catch (err) {
    console.error(`[Gift Settings Error] Failed updating settings for shop ${shop}:`, err);
    return { error: "Failed to save settings. Please try again." };
  }
};