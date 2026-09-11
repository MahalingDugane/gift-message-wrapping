import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  let shop = null;

  try {
    const proxyAuth = await authenticate.public.appProxy(request);
    shop = proxyAuth.session?.shop;
  } catch (err) {
    const url = new URL(request.url);
    const queryShop = url.searchParams.get("shop");
    if (queryShop && queryShop.endsWith(".myshopify.com")) {
      shop = queryShop;
    }
  }

  if (!shop) {
    return new Response(JSON.stringify({ error: "Unauthorized or missing shop" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const settings = await prisma.giftSettings.findUnique({
      where: { shop },
    });

    const designs = await prisma.giftWrappingDesign.findMany({
      where: { shop },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        isDefault: true,
        variantId: true,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        settings: settings || {
          isEnabled: true,
          giftWrapEnabled: true,
          giftMessagePrompt: "Add a gift message",
          giftWrapLabel: "Add Premium Gift Wrapping",
          characterLimit: 250,
          showCharCounter: true,
          requireToFrom: false,
          toLabel: "To",
          fromLabel: "From",
        },
        designs,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("App Proxy API error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};