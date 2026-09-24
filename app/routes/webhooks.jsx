import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session } = await authenticate.webhook(request);

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  console.log(`[Webhook] Topic: ${topic} | Shop: ${shop}`);

  try {
    switch (topic) {
      case "APP_UNINSTALLED":
        if (session) {
          await prisma.session.deleteMany({ where: { shop } });
        }
        break;

      case "CUSTOMERS_DATA_REQUEST":
      case "CUSTOMERS_REDACT":
        // No customer personal data is stored in the app database
        return new Response(JSON.stringify({ message: "No customer data stored" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      case "SHOP_REDACT":
        // Clean up merchant records 48 hours after uninstall
        await prisma.$transaction([
          prisma.giftWrappingDesign.deleteMany({ where: { shop } }),
          prisma.giftSettings.deleteMany({ where: { shop } }),
          prisma.session.deleteMany({ where: { shop } }),
        ]);
        break;

      default:
        return new Response("Unhandled webhook topic", { status: 404 });
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(`[Webhook Error] Processing ${topic} failed:`, error);
    return new Response("Webhook processing error", { status: 500 });
  }
};