import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const afterCursor = url.searchParams.get("after") || null;
  const beforeCursor = url.searchParams.get("before") || null;

  const PAGE_SIZE = 25;
  const queryVariables = {};

  if (beforeCursor) {
    queryVariables.last = PAGE_SIZE;
    queryVariables.before = beforeCursor;
  } else {
    queryVariables.first = PAGE_SIZE;
    if (afterCursor) {
      queryVariables.after = afterCursor;
    }
  }

  const designs = await prisma.giftWrappingDesign.findMany({ where: { shop } });

  let allOrders = [];
  let metrics = { totalMessages: 0, totalWrapped: 0, revenue: 0 };
  let orders = [];
  let pageInfo = {
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: null,
  };

  try {
    const response = await admin.graphql(
      `query getOrders($first: Int, $after: String, $last: Int, $before: String) {
        orders(first: $first, after: $after, last: $last, before: $before, sortKey: CREATED_AT, reverse: true) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            cursor
            node {
              id
              name
              createdAt
              displayFinancialStatus
              customer { firstName lastName email }
              customAttributes { key value }
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    variantTitle
                    variant { id title }
                    originalUnitPriceSet { shopMoney { amount } }
                    customAttributes { key value }
                  }
                }
              }
            }
          }
        }
      }`,
      { variables: queryVariables }
    );

    const data = await response.json();

    if (data.errors?.length) {
      console.error("Shopify GraphQL Orders Query Error:", data.errors);
    }

    const orderEdges = data.data?.orders?.edges || [];
    allOrders = orderEdges.map((e) => e.node);
    pageInfo = data.data?.orders?.pageInfo || pageInfo;

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

    allOrders.forEach((order) => {
      const orderAttrs = order.customAttributes || [];
      const lineItemNodes = order.lineItems?.edges?.map((e) => e.node) || [];

      const isGift = findVal(orderAttrs, ["Is Gift"]) === "Yes";
      let msg = findVal(orderAttrs, ["Gift Message", "Message", "gift_message", "Note"]);
      let to = findVal(orderAttrs, ["To", "Recipient", "Recipient Name", "gift_to"]);
      let from = findVal(orderAttrs, ["From", "Sender", "Sender Name", "gift_from"]);

      if (!to || !from || !msg) {
        for (const item of lineItemNodes) {
          const itemAttrs = item.customAttributes || [];
          if (!to) to = findVal(itemAttrs, ["To", "Recipient", "Recipient Name", "gift_to"]);
          if (!from) from = findVal(itemAttrs, ["From", "Sender", "Sender Name", "gift_from"]);
          if (!msg) msg = findVal(itemAttrs, ["Gift Message", "Message", "gift_message", "Note"]);
        }
      }

      const orderWrapVal = findVal(orderAttrs, ["Gift Wrapping", "Gift Wrap", "wrap"]);
      const hasOrderWrapFlag = normalize(orderWrapVal) === "yes" || normalize(orderWrapVal) === "true";
      const orderDesignVal = findVal(orderAttrs, ["Design", "Wrapping Design", "Selected Design"]);

      let wrappedLineItemPrice = 0;
      let hasWrapItem = false;

      lineItemNodes.forEach((node) => {
        const isWrapLine = node.customAttributes?.some(
          (a) => normalize(a.key) === "_is_gift_wrapping" && (normalize(a.value) === "true" || normalize(a.value) === "yes")
        );
        if (isWrapLine) {
          hasWrapItem = true;
          wrappedLineItemPrice += parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0);
        }
      });

      const hasWrapping = hasOrderWrapFlag || Boolean(orderDesignVal) || hasWrapItem;

      if (isGift || Boolean(msg)) metrics.totalMessages++;
      if (hasWrapping) {
        metrics.totalWrapped++;
        metrics.revenue += wrappedLineItemPrice;
      }

      if (isGift || hasWrapping || Boolean(msg)) {
        let matchedDesign = null;

        if (hasWrapping) {
          if (orderDesignVal && normalize(orderDesignVal) !== "default" && normalize(orderDesignVal) !== "yes") {
            matchedDesign = designs.find(
              (d) => normalize(d.name) === normalize(orderDesignVal) || String(d.id) === String(orderDesignVal)
            ) || null;
          }

          if (!matchedDesign) {
            for (const item of lineItemNodes) {
              const itemDesignVal = findVal(item.customAttributes, ["Design", "Wrapping Design", "Selected Design"]);
              if (itemDesignVal && normalize(itemDesignVal) !== "default" && normalize(itemDesignVal) !== "yes") {
                matchedDesign = designs.find(
                  (d) => normalize(d.name) === normalize(itemDesignVal) || String(d.id) === String(itemDesignVal)
                ) || null;
                if (matchedDesign) break;
              }
            }
          }

          if (!matchedDesign) {
            for (const item of lineItemNodes) {
              const itemVarGid = item.variant?.id;
              const itemVarNum = itemVarGid ? itemVarGid.replace(/\D/g, "") : "";
              if (itemVarNum) {
                matchedDesign = designs.find(
                  (d) => d.variantId && d.variantId.replace(/\D/g, "") === itemVarNum
                ) || null;
                if (matchedDesign) break;
              }
            }
          }

          if (!matchedDesign) {
            for (const item of lineItemNodes) {
              const varTitle = item.variantTitle || item.variant?.title;
              if (varTitle && normalize(varTitle) !== "default title" && normalize(varTitle) !== "default") {
                matchedDesign = designs.find((d) => normalize(d.name) === normalize(varTitle)) || null;
                if (matchedDesign) break;
              }
            }
          }

          if (!matchedDesign) {
            matchedDesign = designs.find((d) => d.isDefault) || designs[0] || null;
          }
        }

        orders.push({
          id: order.id,
          name: order.name,
          createdAt: order.createdAt,
          displayFinancialStatus: order.displayFinancialStatus,
          customer: order.customer,
          giftData: {
            hasWrapping,
            wrapDesignName: matchedDesign?.name || (hasWrapping ? "Standard Wrapping" : "None"),
            wrapImageUrl: matchedDesign?.imageUrl || null,
            wrapPrice: wrappedLineItemPrice > 0 ? wrappedLineItemPrice : (matchedDesign?.price || 0),
            to: to || "N/A",
            from: from || "N/A",
            message: msg || "",
          },
        });
      }
    });
  } catch (err) {
    console.error("Failed to fetch gift messages:", err);
  }

  const shopName = shop.replace(".myshopify.com", "");

  return { shopName, orders, metrics, pageInfo, pageSize: PAGE_SIZE };
};

export default function GiftMessages() {
  const { shopName, orders, metrics, pageInfo, pageSize } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(orders.length > 0 ? orders[0] : null);
  const navigate = useNavigate();

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const formatDate = (dateString) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));

  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase();
    const customerName = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.toLowerCase();
    const orderName = order.name.toLowerCase();
    const msg = (order.giftData?.message || "").toLowerCase();
    const to = (order.giftData?.to || "").toLowerCase();
    const from = (order.giftData?.from || "").toLowerCase();

    return orderName.includes(q) || customerName.includes(q) || msg.includes(q) || to.includes(q) || from.includes(q);
  });

  return (
    <div className="messages-layout">
      <style>{`
        .messages-layout { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f8; min-height: 100vh; padding: 32px; color: #1f2937; position: relative; }
        .page-header { margin-bottom: 28px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 6px 0; }
        .page-desc { color: #6b7280; font-size: 14px; margin: 0; }

        .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 28px; }
        .metric-card { background: white; border-radius: 12px; padding: 22px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .metric-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 12px; }
        .metric-label { font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .metric-val { font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 2px; }
        .metric-sub { font-size: 13px; color: #9ca3af; }

        .content-area { display: flex; gap: 24px; align-items: flex-start; }
        .table-section { flex: 1; min-width: 0; }

        .search-bar { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid #d1d5db; background: white; font-size: 14px; margin-bottom: 16px; box-sizing: border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.03); outline: none; }
        .search-bar:focus { border-color: #008060; }

        .table-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; }
        .table { width: 100%; border-collapse: collapse; text-align: left; }
        .table th { padding: 14px 20px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; }
        .table td { padding: 16px 20px; border-bottom: 1px solid #f3f4f6; font-size: 14px; vertical-align: middle; cursor: pointer; }
        .table tr:hover { background: #f9fafb; }
        .table tr.active-row { background: #f0fdf4; }

        .pagination-container { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: white; border-top: 1px solid #e5e7eb; }
        .pagination-status { font-size: 13px; color: #6b7280; }
        .pagination-buttons { display: flex; gap: 8px; }
        .btn-page { background: white; color: #111827; border: 1px solid #d1d5db; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
        .btn-page:hover:not(:disabled) { background: #f9fafb; border-color: #9ca3af; }
        .btn-page:disabled { opacity: 0.45; cursor: not-allowed; }

        .drawer-card { width: 420px; max-width: 100%; background: white; border-radius: 14px; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px rgba(0,0,0,0.06); padding: 24px; box-sizing: border-box; flex-shrink: 0; position: sticky; top: 24px; }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 16px; margin-bottom: 20px; }
        .drawer-title { font-size: 18px; font-weight: 700; color: #111827; display: flex; align-items: center; gap: 8px; }
        .close-btn { border: none; background: transparent; font-size: 18px; cursor: pointer; color: #9ca3af; }
        .close-btn:hover { color: #111827; }

        .section-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
        .info-item-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px; }
        .info-item-val { font-size: 14px; font-weight: 600; color: #111827; word-break: break-word; }

        .message-quote-box { background: #fff5f7; border-radius: 12px; padding: 16px; margin-bottom: 22px; border: 1px solid #ffe4e8; position: relative; }
        .quote-icon { font-size: 20px; color: #f43f5e; margin-bottom: 6px; }
        .message-text { font-style: italic; font-size: 14px; color: #374151; line-height: 1.6; word-break: break-word; }

        .wrapping-preview-box { display: flex; align-items: center; gap: 16px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px; margin-bottom: 24px; }
        .wrapping-img-box { width: 72px; height: 72px; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; background: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .wrapping-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-gray { background: #f3f4f6; color: #4b5563; }

        .drawer-footer { display: flex; gap: 10px; border-top: 1px solid #f3f4f6; padding-top: 18px; }
        .btn-secondary { flex: 1; text-align: center; background: white; color: #111827; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 13px; border: 1px solid #d1d5db; text-decoration: none; }
        .btn-secondary:hover { background: #f9fafb; }
        .btn-primary { flex: 1.2; text-align: center; background: #008060; color: white; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 13px; border: none; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .btn-primary:hover { background: #006e52; }

        @media (max-width: 900px) {
          .content-area { flex-direction: column; }
          .drawer-card { width: 100%; position: static; }
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Gift Messages & Orders</h1>
        <p className="page-desc">View and manage customer gift messages, wrapping details, and printable gift cards.</p>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon" style={{ background: "#fce7ec", color: "#e11d48" }}>💌</div>
          <div className="metric-label">Total Gift Messages</div>
          <div className="metric-val">{metrics.totalMessages}</div>
          <div className="metric-sub">On current page</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: "#e0e7ff", color: "#4f46e5" }}>🎁</div>
          <div className="metric-label">Orders With Wrapping</div>
          <div className="metric-val">{metrics.totalWrapped}</div>
          <div className="metric-sub">On current page</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: "#dcfce7", color: "#166534" }}>💵</div>
          <div className="metric-label">Wrapping Revenue</div>
          <div className="metric-val">{formatCurrency(metrics.revenue)}</div>
          <div className="metric-sub">On current page</div>
        </div>
      </div>

      <div className="content-area">
        <div className="table-section">
          <input
            type="text"
            className="search-bar"
            placeholder="Search by order number or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>To / From</th>
                  <th>Wrapping</th>
                  <th>Message Preview</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                      No matching gift orders found on this page.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const data = order.giftData;
                    const isSelected = selectedOrder?.id === order.id;

                    return (
                      <tr
                        key={order.id}
                        className={isSelected ? "active-row" : ""}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td style={{ fontWeight: 600, color: "#2563eb" }}>{order.name}</td>
                        <td>
                          {order.customer
                            ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || "Guest"
                            : "Guest"}
                        </td>
                        <td>
                          <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
                            <span style={{ color: "#ef4444" }}>To:</span> {data.to}
                            <br />
                            <span style={{ color: "#6b7280" }}>From:</span> {data.from}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {data.wrapImageUrl ? (
                              <img
                                src={data.wrapImageUrl}
                                alt={data.wrapDesignName}
                                style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
                              />
                            ) : (
                              <span>🎁</span>
                            )}
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 600 }}>{data.wrapDesignName}</div>
                              {data.wrapPrice > 0 && (
                                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                                  {formatCurrency(data.wrapPrice)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "#6b7280", fontStyle: "italic", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          "{data.message || "No message"}"
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* CURSOR PAGINATION BAR */}
            <div className="pagination-container">
              <div className="pagination-status">
                Showing up to {pageSize} orders per page
              </div>
              <div className="pagination-buttons">
                <button
                  type="button"
                  className="btn-page"
                  disabled={!pageInfo.hasPreviousPage}
                  onClick={() => {
                    if (pageInfo.hasPreviousPage && pageInfo.startCursor) {
                      navigate(`?before=${encodeURIComponent(pageInfo.startCursor)}`);
                    }
                  }}
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  className="btn-page"
                  disabled={!pageInfo.hasNextPage}
                  onClick={() => {
                    if (pageInfo.hasNextPage && pageInfo.endCursor) {
                      navigate(`?after=${encodeURIComponent(pageInfo.endCursor)}`);
                    }
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>

        {selectedOrder && (() => {
          const orderId = selectedOrder.id.split("/").pop();
          const data = selectedOrder.giftData;

          return (
            <div className="drawer-card">
              <div className="drawer-header">
                <div className="drawer-title">
                  <span>🎁</span> Order {selectedOrder.name}
                </div>
                <button type="button" className="close-btn" onClick={() => setSelectedOrder(null)}>
                  ✕
                </button>
              </div>

              <div className="section-label">Order Information</div>
              <div className="info-grid">
                <div>
                  <div className="info-item-label">Customer</div>
                  <div className="info-item-val">
                    {selectedOrder.customer
                      ? `${selectedOrder.customer.firstName || ""} ${selectedOrder.customer.lastName || ""}`.trim() || "Guest"
                      : "Guest"}
                  </div>
                </div>
                <div>
                  <div className="info-item-label">Date</div>
                  <div className="info-item-val">{formatDate(selectedOrder.createdAt)}</div>
                </div>
                <div>
                  <div className="info-item-label">Recipient (To)</div>
                  <div className="info-item-val">{data.to}</div>
                </div>
                <div>
                  <div className="info-item-label">Sender (From)</div>
                  <div className="info-item-val">{data.from}</div>
                </div>
              </div>

              <div className="section-label">Gift Message</div>
              <div className="message-quote-box">
                <div className="quote-icon">“</div>
                <div className="message-text">{data.message || "No message attached."}</div>
              </div>

              <div className="section-label">Gift Wrapping</div>
              <div className="wrapping-preview-box">
                <div className="wrapping-img-box">
                  {data.wrapImageUrl ? (
                    <img src={data.wrapImageUrl} alt={data.wrapDesignName} className="wrapping-img" />
                  ) : (
                    <span style={{ fontSize: "28px" }}>🎁</span>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#111827", marginBottom: "4px" }}>
                    {data.wrapDesignName}
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <span className={`badge ${data.hasWrapping ? "badge-green" : "badge-gray"}`}>
                      {data.hasWrapping ? "Wrapped" : "None"}
                    </span>
                  </div>
                  {data.wrapPrice > 0 && (
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#008060" }}>
                      {formatCurrency(data.wrapPrice)}
                    </div>
                  )}
                </div>
              </div>

              <div className="drawer-footer">
                <a
                  href={`https://admin.shopify.com/store/${shopName}/orders/${orderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  View in Shopify
                </a>
                <Link to={`/app/print/${orderId}`} className="btn-primary">
                  🖨️ Print Gift Card
                </Link>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}