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
              displayFulfillmentStatus
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

    orderEdges.forEach(({ node: order }) => {
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
          financialStatus: order.displayFinancialStatus || "PAID",
          fulfillmentStatus: order.displayFulfillmentStatus || "UNFULFILLED",
          customer: order.customer,
          hasWrapping,
          wrapDesignName: matchedDesign?.name || (hasWrapping ? "Standard Wrapping" : "None"),
          wrapPrice: wrappedLineItemPrice > 0 ? wrappedLineItemPrice : (matchedDesign?.price || 0),
          to: to || "N/A",
          from: from || "N/A",
          message: msg || "",
        });
      }
    });
  } catch (err) {
    console.error("Failed to fetch gift orders:", err);
  }

  const shopName = shop.replace(".myshopify.com", "");

  return { shopName, orders, pageInfo, pageSize: PAGE_SIZE };
};

export default function GiftOrders() {
  const { shopName, orders, pageInfo, pageSize } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
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
    const msg = (order.message || "").toLowerCase();
    const to = (order.to || "").toLowerCase();
    const from = (order.from || "").toLowerCase();
    const design = (order.wrapDesignName || "").toLowerCase();

    return (
      orderName.includes(q) ||
      customerName.includes(q) ||
      msg.includes(q) ||
      to.includes(q) ||
      from.includes(q) ||
      design.includes(q)
    );
  });

  return (
    <div className="orders-layout">
      <style>{`
        .orders-layout { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f8; min-height: 100vh; padding: 32px; color: #1f2937; }
        .page-header { margin-bottom: 24px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 6px 0; }
        .page-desc { color: #6b7280; font-size: 14px; margin: 0; }

        .search-bar { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid #d1d5db; background: white; font-size: 14px; margin-bottom: 16px; box-sizing: border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.03); outline: none; }
        .search-bar:focus { border-color: #008060; }

        .table-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; }
        .table { width: 100%; border-collapse: collapse; text-align: left; }
        .table th { padding: 14px 20px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; }
        .table td { padding: 16px 20px; border-bottom: 1px solid #f3f4f6; font-size: 14px; vertical-align: middle; }
        .table tr:hover { background: #f9fafb; }

        .badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-gray { background: #f3f4f6; color: #4b5563; }

        .pagination-container { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: white; border-top: 1px solid #e5e7eb; }
        .pagination-status { font-size: 13px; color: #6b7280; }
        .pagination-buttons { display: flex; gap: 8px; }
        .btn-page { background: white; color: #111827; border: 1px solid #d1d5db; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
        .btn-page:hover:not(:disabled) { background: #f9fafb; border-color: #9ca3af; }
        .btn-page:disabled { opacity: 0.45; cursor: not-allowed; }

        .btn-print-link { display: inline-flex; align-items: center; gap: 6px; background: #008060; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; }
        .btn-print-link:hover { background: #006e52; }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Gift Orders</h1>
        <p className="page-desc">All customer orders containing gift messages or wrapping services.</p>
      </div>

      <input
        type="text"
        className="search-bar"
        placeholder="Search by order number, customer, recipient, or design..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Customer</th>
              <th>To / From</th>
              <th>Wrapping</th>
              <th>Message</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                  No gift orders found on this page.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const numericOrderId = order.id.split("/").pop();

                return (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600, color: "#2563eb" }}>{order.name}</td>
                    <td style={{ fontSize: "12px", color: "#6b7280" }}>{formatDate(order.createdAt)}</td>
                    <td>
                      {order.customer
                        ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || "Guest"
                        : "Guest"}
                    </td>
                    <td>
                      <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
                        <span style={{ color: "#ef4444" }}>To:</span> {order.to}
                        <br />
                        <span style={{ color: "#6b7280" }}>From:</span> {order.from}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span className={`badge ${order.hasWrapping ? "badge-green" : "badge-gray"}`}>
                          {order.wrapDesignName}
                        </span>
                        {order.wrapPrice > 0 && (
                          <div style={{ fontSize: "11px", color: "#008060", marginTop: "2px" }}>
                            +{formatCurrency(order.wrapPrice)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic", color: "#4b5563" }}>
                      "{order.message || "No message"}"
                    </td>
                    <td>
                      <Link to={`/app/print/${numericOrderId}`} className="btn-print-link">
                        🖨️ Print Card
                      </Link>
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
  );
}