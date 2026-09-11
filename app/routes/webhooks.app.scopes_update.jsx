import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  // Authenticate the webhook and verify the HMAC signature
  const { topic, shop } = await authenticate.webhook(request);

  if (!shop) {
    return new Response("Bad Request: Missing shop context", { status: 400 });
  }

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      // The app does not maintain a dedicated Prisma table for customer PII.
      // Gift message data resides within Shopify order attributes.
      // Safely acknowledge without deletion.
      return new Response("Customer request acknowledged", { status: 200 });

    case "SHOP_REDACT":
      // Safely delete all shop-specific data scoped strictly to the authenticated shop
      await prisma.giftWrappingDesign.deleteMany({ where: { shop } });
      await prisma.giftSettings.deleteMany({ where: { shop } });
      await prisma.session.deleteMany({ where: { shop } });
      
      return new Response("Shop data redacted successfully", { status: 200 });

    default:
      // Return a non-success response for unhandled webhook topics
      return new Response("Unhandled webhook topic", { status: 404 });
  }
};