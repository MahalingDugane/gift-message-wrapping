import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session } = await authenticate.webhook(request);

  if (!shop) {
    return new Response("Bad Request: Missing shop", { status: 400 });
  }

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      return new Response("Customer data request acknowledged", { status: 200 });

    case "CUSTOMERS_REDACT":
      return new Response("Customer redaction request acknowledged", { status: 200 });

    case "SHOP_REDACT":
      await prisma.giftWrappingDesign.deleteMany({ where: { shop } });
      await prisma.giftSettings.deleteMany({ where: { shop } });
      await prisma.session.deleteMany({ where: { shop } });
      return new Response("Shop data redacted successfully", { status: 200 });

    default:
      return new Response("Unhandled webhook topic", { status: 404 });
  }
};
