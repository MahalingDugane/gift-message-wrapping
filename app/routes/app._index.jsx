import { Link, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.giftSettings.findUnique({ where: { shop } });
  if (!settings) {
    settings = await prisma.giftSettings.create({
      data: {
        shop,
        isEnabled: true,
        giftWrapEnabled: true,
        giftMessagePrompt: "Add a gift message",
        giftWrapLabel: "Add Premium Gift Box",
      },
    });
  }

  let activeDesign = await prisma.giftWrappingDesign.findFirst({ where: { shop, isDefault: true } });
  if (!activeDesign) {
    activeDesign = await prisma.giftWrappingDesign.findFirst({ where: { shop } });
  }

  let orders = [];
  let metrics = { totalMessages: 0, totalWrapped: 0, revenue: 0 };

  try {
    const response = await admin.graphql(`
      query {
        orders(first: 50, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              customer { firstName lastName }
              customAttributes { key value }
              lineItems(first: 50) {
                edges {
                  node {
                    originalUnitPriceSet { shopMoney { amount } }
                    customAttributes { key value }
                  }
                }
              }
            }
          }
        }
      }
    `);
    const data = await response.json();
    const allOrders = data.data?.orders?.edges?.map((e) => e.node) || [];

    allOrders.forEach((order) => {
      const isGift = order.customAttributes?.find((a) => a.key === "Is Gift")?.value === "Yes";
      const hasMessage = order.customAttributes?.find((a) => a.key === "Gift Message")?.value;
      const wrapAttr = order.customAttributes?.find((a) => a.key === "Gift Wrapping")?.value === "Yes";

      let wrappedLineItemPrice = 0;
      let hasWrapItem = false;

      order.lineItems?.edges?.forEach(({ node }) => {
        if (node.customAttributes?.find((a) => a.key === "_is_gift_wrapping")) {
          hasWrapItem = true;
          wrappedLineItemPrice += parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0);
        }
      });

      if (isGift && hasMessage) metrics.totalMessages++;
      if (wrapAttr || hasWrapItem) {
        metrics.totalWrapped++;
        metrics.revenue += wrappedLineItemPrice;
      }
    });

    orders = allOrders
      .filter((order) => {
        const isGift = order.customAttributes?.find((a) => a.key === "Is Gift")?.value === "Yes";
        const hasWrap = order.customAttributes?.find((a) => a.key === "Gift Wrapping")?.value === "Yes";
        const hasWrapItem = order.lineItems?.edges?.some(({ node }) =>
          node.customAttributes?.some((a) => a.key === "_is_gift_wrapping")
        );
        return isGift || hasWrap || hasWrapItem;
      })
      .slice(0, 10);
  } catch (err) {
    console.error("Failed to fetch dashboard orders:", err);
  }

  const shopName = shop.replace(".myshopify.com", "");

  return { shop, shopName, settings, activeDesign, orders, metrics };
};

export default function Dashboard() {
  const { shopName, activeDesign, orders, metrics } = useLoaderData();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  const formatDate = (dateString) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));

  return (
    <div className="dashboard-layout">
      <style>{`
        .dashboard-layout { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f8; min-height: 100vh; padding: 32px; color: #1f2937; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 8px 0; }
        .page-desc { color: #6b7280; font-size: 14px; margin: 0; }
        .btn-primary { background: #008060; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; transition: background 0.2s; border: none; cursor: pointer; }
        .btn-primary:hover { background: #006e52; }
        .btn-secondary { background: white; color: #111827; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #d1d5db; display: inline-block; transition: background 0.2s; margin-left: 12px; }
        .btn-secondary:hover { background: #f9fafb; }
        
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px; }
        .card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .metric-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px; }
        .metric-label { font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .metric-val { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 4px; }
        .metric-sub { font-size: 13px; color: #9ca3af; }

        .table-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
        .table-header { padding: 20px 24px; border-bottom: 1px solid #e5e7eb; font-size: 16px; font-weight: 600; color: #111827; }
        .table { width: 100%; border-collapse: collapse; text-align: left; }
        .table th { padding: 16px 24px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; }
        .table td { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; font-size: 14px; vertical-align: middle; }
        .table tr:hover { background: #f9fafb; }
        .table tr:last-child td { border-bottom: none; }
        
        .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-gray { background: #f3f4f6; color: #4b5563; }
        .badge-pink { background: #fce7ec; color: #e11d48; }

        .empty-state { text-align: center; padding: 40px 20px; color: #6b7280; }
        .empty-icon { font-size: 40px; margin-bottom: 16px; opacity: 0.5; }
      `}</style>

      {isLoading ? (
        <div className="empty-state">Loading dashboard data...</div>
      ) : (
        <>
          <div className="header">
            <div>
              <h1 className="page-title">Gift Message & Wrapping</h1>
              <p className="page-desc">Manage gift messages, wrapping designs, orders, and customer gifting options.</p>
            </div>
            <div>
              <a
                href={`https://${shopName}.myshopify.com`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                Open Storefront
              </a>
              <Link to="/app/messages" className="btn-primary">
                View Gift Orders
              </Link>
            </div>
          </div>

          <div className="metric-grid">
            <div className="card">
              <div className="metric-icon" style={{ background: "#fce7ec", color: "#e11d48" }}>
                💌
              </div>
              <div className="metric-label">Total Gift Messages</div>
              <div className="metric-val">{metrics.totalMessages}</div>
              <div className="metric-sub">Gift orders received</div>
            </div>
            <div className="card">
              <div className="metric-icon" style={{ background: "#e0e7ff", color: "#4f46e5" }}>
                🎁
              </div>
              <div className="metric-label">Wrapped Orders</div>
              <div className="metric-val">{metrics.totalWrapped}</div>
              <div className="metric-sub">Orders with paid wrapping</div>
            </div>
            <div className="card">
              <div className="metric-icon" style={{ background: "#dcfce7", color: "#166534" }}>
                💵
              </div>
              <div className="metric-label">Wrapping Revenue</div>
              <div className="metric-val">{formatCurrency(metrics.revenue)}</div>
              <div className="metric-sub">Estimated wrapping revenue</div>
            </div>
            <div className="card">
              <div className="metric-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
                ✨
              </div>
              <div className="metric-label">Active Wrapping Design</div>
              <div className="metric-val" style={{ fontSize: "20px", marginTop: "8px" }}>
                {activeDesign ? activeDesign.name : "No active design"}
              </div>
              <div className="metric-sub">
                {activeDesign ? `Price: ${formatCurrency(activeDesign.price)}` : "Setup required"}
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-header">Recent Gift Orders</div>
            {orders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <h3>No recent orders yet.</h3>
                <p>When customers add gift messages or wrapping, they will appear here.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Gift Message</th>
                      <th>Wrapping</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const orderId = order.id.split("/").pop();
                      const isGift =
                        order.customAttributes?.find((a) => a.key === "Is Gift")?.value === "Yes";
                      const hasWrap =
                        order.customAttributes?.find((a) => a.key === "Gift Wrapping")?.value === "Yes";
                      const wrapDesign =
                        order.customAttributes?.find((a) => a.key === "Design")?.value || "Default";

                      return (
                        <tr key={order.id}>
                          <td>
                            <a
                              href={`https://admin.shopify.com/store/${shopName}/orders/${orderId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                            >
                              {order.name}
                            </a>
                          </td>
                          <td>
                            {order.customer
                              ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || "Guest"
                              : "Guest"}
                          </td>
                          <td>
                            <span className={`badge ${isGift ? "badge-pink" : "badge-gray"}`}>
                              {isGift ? "Added" : "None"}
                            </span>
                          </td>
                          <td>
                            {hasWrap ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span className="badge badge-green">Wrapped</span>
                                <span style={{ fontSize: "12px", color: "#6b7280" }}>{wrapDesign}</span>
                              </div>
                            ) : (
                              <span className="badge badge-gray">None</span>
                            )}
                          </td>
                          <td>{order.displayFinancialStatus}</td>
                          <td>{formatDate(order.createdAt)}</td>
                          <td>
                            <Link
                              to={`/app/print/${orderId}`}
                              className="btn-secondary"
                              style={{
                                margin: 0,
                                padding: "6px 12px",
                                fontSize: "12px",
                                textDecoration: "none",
                                display: "inline-block",
                              }}
                            >
                              Print Card
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}