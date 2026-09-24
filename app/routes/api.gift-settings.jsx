import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  let shop = null;

  try {
    // Cryptographically verifies Shopify's HMAC signature on the proxy request
    const { session } = await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    // Extract shop strictly after cryptographic validation passes
    shop = session?.shop || url.searchParams.get("shop");
  } catch (authError) {
    console.warn("[AppProxy] Cryptographic verification failed:", authError?.message || authError);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Invalid or missing Shopify signature",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  if (!shop) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: No verified shop domain found",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
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
        designs: designs || [],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (dbError) {
    console.error(`[AppProxy] Database query failure for shop ${shop}:`, dbError);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error retrieving gift settings",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
};