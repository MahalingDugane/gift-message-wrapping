import { useLoaderData, useNavigate } from "react-router";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Sanitize order ID to prevent malformed gid:// prefixes
  const rawId = String(params.orderId || "");
  const numericId = rawId.replace(/\D/g, "");
  const orderGid = numericId ? `gid://shopify/Order/${numericId}` : `gid://shopify/Order/${rawId}`;

  // 2. Query settings and wrapping designs safely
  const settings = await prisma.giftSettings.findUnique({ where: { shop } });
  const designs = await prisma.giftWrappingDesign.findMany({ where: { shop } });

  // 3. Query order attributes AND lineItems
  const response = await admin.graphql(
    `query($id: ID!) {
      order(id: $id) {
        id
        name
        customAttributes { key value }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              variantTitle
              variant { id title }
              customAttributes { key value }
            }
          }
        }
      }
    }`,
    { variables: { id: orderGid } }
  );

  const data = await response.json();
  const order = data.data?.order;
  const orderAttrs = order?.customAttributes || [];
  const lineItemNodes = order?.lineItems?.edges?.map((e) => e.node) || [];

  const normalize = (val) => String(val || "").trim().toLowerCase();

  const findVal = (list, keys) => {
    if (!Array.isArray(list)) return "";
    for (const k of keys) {
      const found = list.find((a) => a.key && normalize(a.key) === normalize(k));
      if (found?.value) return found.value;
    }
    for (const k of keys) {
      const found = list.find((a) => a.key && normalize(a.key).includes(normalize(k)));
      if (found?.value) return found.value;
    }
    return "";
  };

  // 4. Resolve To, From, and Message
  let to = findVal(orderAttrs, ["To", "Recipient", "Recipient Name", "gift_to"]);
  let from = findVal(orderAttrs, ["From", "Sender", "Sender Name", "gift_from"]);
  let msg = findVal(orderAttrs, ["Gift Message", "Message", "gift_message", "Note"]);

  if (!to || !from || !msg) {
    for (const item of lineItemNodes) {
      const itemAttrs = item.customAttributes || [];
      if (!to) to = findVal(itemAttrs, ["To", "Recipient", "Recipient Name", "gift_to"]);
      if (!from) from = findVal(itemAttrs, ["From", "Sender", "Sender Name", "gift_from"]);
      if (!msg) msg = findVal(itemAttrs, ["Gift Message", "Message", "gift_message", "Note"]);
    }
  }

  // 5. Determine if wrapping was selected for this order
  const orderWrapVal = findVal(orderAttrs, ["Gift Wrapping", "Gift Wrap", "wrap"]);
  const hasOrderWrapFlag = normalize(orderWrapVal) === "yes" || normalize(orderWrapVal) === "true";
  const orderDesignVal = findVal(orderAttrs, ["Design", "Wrapping Design", "Selected Design"]);
  
  const hasLineWrapFlag = lineItemNodes.some((item) =>
    item.customAttributes?.some(
      (a) => normalize(a.key) === "_is_gift_wrapping" && (normalize(a.value) === "true" || normalize(a.value) === "yes")
    )
  );

  const hasWrapping = hasOrderWrapFlag || Boolean(orderDesignVal) || hasLineWrapFlag;
  let activeDesign = null;

  if (hasWrapping) {
    // Priority 1: Order customAttributes
    if (orderDesignVal && normalize(orderDesignVal) !== "default" && normalize(orderDesignVal) !== "yes") {
      activeDesign = designs.find(
        (d) => normalize(d.name) === normalize(orderDesignVal) || String(d.id) === String(orderDesignVal)
      ) || null;
    }

    // Priority 2: Line-item customAttributes
    if (!activeDesign) {
      for (const item of lineItemNodes) {
        const itemDesignVal = findVal(item.customAttributes, ["Design", "Wrapping Design", "Selected Design"]);
        if (itemDesignVal && normalize(itemDesignVal) !== "default" && normalize(itemDesignVal) !== "yes") {
          activeDesign = designs.find(
            (d) => normalize(d.name) === normalize(itemDesignVal) || String(d.id) === String(itemDesignVal)
          ) || null;
          if (activeDesign) break;
        }
      }
    }

    // Priority 3: Variant ID match
    if (!activeDesign) {
      for (const item of lineItemNodes) {
        const itemVarGid = item.variant?.id;
        const itemVarNum = itemVarGid ? itemVarGid.replace(/\D/g, "") : "";
        if (itemVarNum) {
          activeDesign = designs.find(
            (d) => d.variantId && d.variantId.replace(/\D/g, "") === itemVarNum
          ) || null;
          if (activeDesign) break;
        }
      }
    }

    // Priority 4: Variant title match
    if (!activeDesign) {
      for (const item of lineItemNodes) {
        const varTitle = item.variantTitle || item.variant?.title;
        if (varTitle && normalize(varTitle) !== "default title" && normalize(varTitle) !== "default") {
          activeDesign = designs.find(
            (d) => normalize(d.name) === normalize(varTitle)
          ) || null;
          if (activeDesign) break;
        }
      }
    }

    // Priority 5: Default fallback
    if (!activeDesign) {
      activeDesign = designs.find((d) => d.isDefault) || designs[0] || null;
    }
  }

  // Determine initial aesthetic style based on design name
  const designNameLower = normalize(activeDesign?.name || "");
  let initialTheme = "minimal";
  if (designNameLower.includes("gold") || designNameLower.includes("luxury")) {
    initialTheme = "gold";
  } else if (designNameLower.includes("kraft") || designNameLower.includes("classic")) {
    initialTheme = "kraft";
  } else if (designNameLower.includes("floral") || designNameLower.includes("flower") || designNameLower.includes("botanical")) {
    initialTheme = "floral";
  }

  return {
    orderName: order?.name || `#${numericId || params.orderId}`,
    to: to || "A Special Someone",
    from: from || "A Friend",
    msg: msg || "A gift specially selected for you.",
    activeDesign,
    hasWrapping,
    initialTheme,
    signature: settings?.storeSignature || "",
  };
};

export default function PrintCard() {
  const { orderName, to, from, msg, activeDesign, initialTheme, signature } = useLoaderData();
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);
  const navigate = useNavigate();

  return (
    <div className="print-page-bg">
      <style>{`
        body {
          background: #f1f2f4;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .print-page-bg {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
          padding: 30px 20px 60px 20px;
          box-sizing: border-box;
        }

        /* Top Action Bar */
        .top-action-bar {
          width: 100%;
          max-width: 17cm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          background: white;
          padding: 12px 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border: 1px solid #e5e7eb;
          box-sizing: border-box;
        }
        .theme-selector-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .theme-selector-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-right: 4px;
        }
        .theme-pill-btn {
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .theme-pill-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }
        .theme-pill-btn.active {
          background: #111827;
          color: #ffffff;
          border-color: #111827;
        }

        .btn-back {
          background: #ffffff;
          color: #111827;
          border: 1px solid #d1d5db;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.15s;
        }
        .btn-back:hover { background: #f9fafb; }

        .btn-print {
          background: #008060;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          box-shadow: 0 2px 4px rgba(0, 128, 96, 0.2);
          transition: background 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn-print:hover { background: #006e52; }

        /* Card Container (Standard 16cm x 11cm greeting card) */
        .gift-card {
          width: 16cm;
          min-height: 11cm;
          border-radius: 12px;
          padding: 38px 46px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.08);
          position: relative;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.25s ease;
        }

        /* ------------------------------------------------------------- */
        /* THEME 1: LUXURY GOLD                                          */
        /* ------------------------------------------------------------- */
        .gift-card.theme-gold {
          background: #fffdf9;
          border: 3px double #d4af37;
          color: #2b2518;
          box-shadow: 0 16px 36px rgba(212, 175, 55, 0.12), 0 0 0 4px #faf5e6;
        }
        .theme-gold .card-header-badge {
          color: #996515;
          letter-spacing: 3px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          text-transform: uppercase;
          border-bottom: 1px solid #ebd99f;
          padding-bottom: 12px;
          margin-bottom: 22px;
        }
        .theme-gold .person-label {
          color: #996515;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 700;
        }
        .theme-gold .person-value {
          color: #1a150c;
          font-family: "Georgia", serif;
          font-size: 19px;
          font-weight: bold;
        }
        .theme-gold .to-from-divider {
          border-bottom: 1px solid #f2e3be;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .theme-gold .card-message-text {
          font-family: "Georgia", serif;
          font-size: 19px;
          line-height: 1.8;
          color: #2e2617;
          font-style: italic;
          text-align: center;
          padding: 10px 18px;
        }
        .theme-gold .card-signature {
          color: #8c6d32;
          font-style: italic;
          font-family: "Georgia", serif;
        }
        .theme-gold .card-footer {
          border-top: 1px solid #ebd99f;
          color: #a38851;
        }

        /* ------------------------------------------------------------- */
        /* THEME 2: CLASSIC KRAFT                                        */
        /* ------------------------------------------------------------- */
        .gift-card.theme-kraft {
          background: #fbf7ef;
          border: 2px dashed #bba48b;
          color: #382e25;
          box-shadow: 0 16px 36px rgba(139, 115, 85, 0.1);
        }
        .theme-kraft .card-header-badge {
          color: #785e44;
          letter-spacing: 2px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          text-transform: uppercase;
          border-bottom: 1px dashed #d5c3af;
          padding-bottom: 12px;
          margin-bottom: 22px;
        }
        .theme-kraft .person-label {
          color: #785e44;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 700;
        }
        .theme-kraft .person-value {
          color: #2b2118;
          font-family: "Courier New", Courier, monospace;
          font-size: 18px;
          font-weight: bold;
        }
        .theme-kraft .to-from-divider {
          border-bottom: 1px dashed #d5c3af;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .theme-kraft .card-message-text {
          font-family: "Georgia", serif;
          font-size: 18px;
          line-height: 1.8;
          color: #3b3024;
          font-style: italic;
          text-align: center;
          padding: 10px 18px;
        }
        .theme-kraft .card-signature {
          color: #6e543b;
          font-weight: 600;
        }
        .theme-kraft .card-footer {
          border-top: 1px dashed #d5c3af;
          color: #8c7359;
        }

        /* ------------------------------------------------------------- */
        /* THEME 3: FLORAL & BOTANICAL                                   */
        /* ------------------------------------------------------------- */
        .gift-card.theme-floral {
          background: #fffbfa;
          border: 2px solid #e8b4b8;
          color: #3b2a2e;
          box-shadow: 0 16px 36px rgba(232, 180, 184, 0.2);
        }
        .theme-floral .card-header-badge {
          color: #b75d69;
          letter-spacing: 2px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          text-transform: uppercase;
          border-bottom: 1px solid #f6d8db;
          padding-bottom: 12px;
          margin-bottom: 22px;
        }
        .theme-floral .person-label {
          color: #b75d69;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 700;
        }
        .theme-floral .person-value {
          color: #2d1e22;
          font-family: "Georgia", serif;
          font-size: 19px;
          font-weight: bold;
        }
        .theme-floral .to-from-divider {
          border-bottom: 1px solid #f6d8db;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .theme-floral .card-message-text {
          font-family: "Georgia", serif;
          font-size: 18px;
          line-height: 1.8;
          color: #3d2a2f;
          font-style: italic;
          text-align: center;
          padding: 10px 18px;
        }
        .theme-floral .card-signature {
          color: #b75d69;
          font-style: italic;
        }
        .theme-floral .card-footer {
          border-top: 1px solid #f6d8db;
          color: #c4828b;
        }

        /* ------------------------------------------------------------- */
        /* THEME 4: MODERN MINIMALIST                                    */
        /* ------------------------------------------------------------- */
        .gift-card.theme-minimal {
          background: #ffffff;
          border: 1px solid #111827;
          color: #111827;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.06);
        }
        .theme-minimal .card-header-badge {
          color: #4b5563;
          letter-spacing: 3px;
          font-size: 10px;
          font-weight: 700;
          text-align: center;
          text-transform: uppercase;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 12px;
          margin-bottom: 22px;
        }
        .theme-minimal .person-label {
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 700;
        }
        .theme-minimal .person-value {
          color: #111827;
          font-size: 18px;
          font-weight: 700;
        }
        .theme-minimal .to-from-divider {
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .theme-minimal .card-message-text {
          font-family: "Georgia", serif;
          font-size: 18px;
          line-height: 1.8;
          color: #374151;
          font-style: italic;
          text-align: center;
          padding: 10px 18px;
        }
        .theme-minimal .card-signature {
          color: #4b5563;
          font-weight: 500;
        }
        .theme-minimal .card-footer {
          border-top: 1px solid #e5e7eb;
          color: #9ca3af;
        }

        /* Shared Card Internals */
        .to-from-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .card-signature {
          text-align: center;
          margin-top: 24px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding-top: 10px;
        }

        /* ------------------------------------------------------------- */
        /* PRINT MEDIA - HIDE ALL UI, PRINT ONLY CARD                    */
        /* ------------------------------------------------------------- */
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .print-page-bg {
            padding: 0 !important;
            display: block !important;
            min-height: auto !important;
          }
          .top-action-bar, .no-print {
            display: none !important;
          }
          .gift-card {
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 3cm 2.5cm !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Controls Hidden During Printing) */}
      <div className="top-action-bar no-print">
        <button
          type="button"
          className="btn-back"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app"))}
        >
          ⬅️ Back
        </button>

        <div className="theme-selector-group">
          <span className="theme-selector-label">Card Style:</span>
          <button
            type="button"
            className={`theme-pill-btn ${selectedTheme === "gold" ? "active" : ""}`}
            onClick={() => setSelectedTheme("gold")}
          >
            ✨ Luxury Gold
          </button>
          <button
            type="button"
            className={`theme-pill-btn ${selectedTheme === "kraft" ? "active" : ""}`}
            onClick={() => setSelectedTheme("kraft")}
          >
            📦 Classic Kraft
          </button>
          <button
            type="button"
            className={`theme-pill-btn ${selectedTheme === "floral" ? "active" : ""}`}
            onClick={() => setSelectedTheme("floral")}
          >
            🌸 Floral Botanical
          </button>
          <button
            type="button"
            className={`theme-pill-btn ${selectedTheme === "minimal" ? "active" : ""}`}
            onClick={() => setSelectedTheme("minimal")}
          >
            ✉️ Modern Minimal
          </button>
        </div>

        <button type="button" className="btn-print" onClick={() => window.print()}>
          🖨️ Print Card
        </button>
      </div>

      {/* Actual Gift Card (No Images - Pure High-End Stationery) */}
      <div className={`gift-card theme-${selectedTheme}`}>
        <div>
          <div className="card-header-badge">
            {selectedTheme === "gold" && "✦ A LUXURY GIFT FOR YOU ✦"}
            {selectedTheme === "kraft" && "✦ SPECIALLY WRAPPED & DELIVERED ✦"}
            {selectedTheme === "floral" && "✿ HANDCRAFTED WITH CARE ✿"}
            {selectedTheme === "minimal" && "GIFT COMPLIMENTS"}
          </div>

          <div className="to-from-row to-from-divider">
            <div>
              <div className="person-label">To</div>
              <div className="person-value">{to}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="person-label">From</div>
              <div className="person-value">{from}</div>
            </div>
          </div>
        </div>

        <div className="card-message-text">{msg}</div>

        <div>
          {signature && <div className="card-signature">{signature}</div>}

          <div className="card-footer">
            <span>Order: {orderName}</span>
            <span>
              {activeDesign?.name ? `Design: ${activeDesign.name}` : "Standard Packaging"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}