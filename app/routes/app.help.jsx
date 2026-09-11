export default function HelpAndSupport() {
  return (
    <div style={{ padding: "24px 32px", maxWidth: "1050px", margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", margin: "0 0 6px 0", color: "#111827" }}>
          ❓ Help & Support Guide
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>
          Everything you need to know about setting up, customizing, and fulfilling gift orders with GiftNote.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Section 1: Step-by-Step Installation */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "28px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: "0 0 16px 0", color: "#111827" }}>
            🎨 1. How to Add the App Block to Your Storefront
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            {/* Step A: Cart Page */}
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span
                  style={{
                    background: "#008060",
                    color: "white",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                  }}
                >
                  A
                </span>
                <strong style={{ fontSize: "1rem", color: "#111827" }}>
                  Cart Page / Drawer (Whole Order)
                </strong>
              </div>
              <ol style={{ margin: 0, paddingLeft: "18px", color: "#4b5563", fontSize: "0.875rem", lineHeight: "1.7" }}>
                <li>From your Shopify Admin, click <strong>Online Store &gt; Themes</strong>.</li>
                <li>Click <strong>Customize</strong> on your current theme (e.g. Dawn).</li>
                <li>In the top dropdown, select <strong>Cart</strong>.</li>
                <li>In the left sidebar under the Subtotal/Cart section, click <strong>Add block</strong>.</li>
                <li>Select <strong>🎁 Gift Message (Cart)</strong>.</li>
                <li>Click <strong>Save</strong> in the top right corner.</li>
              </ol>
            </div>

            {/* Step B: Product Page */}
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span
                  style={{
                    background: "#008060",
                    color: "white",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                  }}
                >
                  B
                </span>
                <strong style={{ fontSize: "1rem", color: "#111827" }}>
                  Product Page (Per Product)
                </strong>
              </div>
              <ol style={{ margin: 0, paddingLeft: "18px", color: "#4b5563", fontSize: "0.875rem", lineHeight: "1.7" }}>
                <li>In the Theme Editor, select <strong>Products &gt; Default product</strong> from the top dropdown.</li>
                <li>Under <strong>Product information</strong>, click <strong>Add block</strong>.</li>
                <li>Select <strong>🎁 Gift Message (Product)</strong>.</li>
                <li>Drag the block right above the "Buy buttons".</li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Section 2: How It Works Flow */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "28px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: "0 0 16px 0", color: "#111827" }}>
            🔄 2. How GiftNote Works
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "8px" }}>🛍️</div>
              <strong style={{ color: "#0f172a" }}>1. Customer Types Note</strong>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "#64748b", lineHeight: "1.5" }}>
                The customer checks "Is this a gift?", enters their note, and selects optional gift wrapping.
              </p>
            </div>

            <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "8px" }}>💾</div>
              <strong style={{ color: "#0f172a" }}>2. Native Shopify Sync</strong>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "#64748b", lineHeight: "1.5" }}>
                The message is attached directly into Cart Attributes and Line Item Properties without third-party redirects.
              </p>
            </div>

            <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "8px" }}>🖨️</div>
              <strong style={{ color: "#0f172a" }}>3. Print & Pack</strong>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "#64748b", lineHeight: "1.5" }}>
                When packing orders, open the <strong>Gift Messages</strong> tab to view notes or print high-res cards.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: FAQs */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "28px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: "0 0 16px 0", color: "#111827" }}>
            💡 3. Frequently Asked Questions (FAQ)
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <details style={{ background: "#f9fafb", padding: "14px 18px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <summary style={{ fontWeight: "600", cursor: "pointer", color: "#111827" }}>
                Where can I see the gift message when an order is placed?
              </summary>
              <p style={{ margin: "8px 0 0 0", fontSize: "0.875rem", color: "#4b5563", lineHeight: "1.5" }}>
                You can see it in <strong>two places</strong>: in the <strong>Gift Messages</strong> tab inside this app, and natively on the Shopify Admin Order Details page under "Additional Details" or the line item properties!
              </p>
            </details>

            <details style={{ background: "#f9fafb", padding: "14px 18px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <summary style={{ fontWeight: "600", cursor: "pointer", color: "#111827" }}>
                Can I customize colors to match my store's brand?
              </summary>
              <p style={{ margin: "8px 0 0 0", fontSize: "0.875rem", color: "#4b5563", lineHeight: "1.5" }}>
                Yes! When editing your theme in Shopify Theme Editor, click on the <strong>Gift Message</strong> block to change background colors, border radius, accent colors, and text.
              </p>
            </details>

            <details style={{ background: "#f9fafb", padding: "14px 18px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <summary style={{ fontWeight: "600", cursor: "pointer", color: "#111827" }}>
                How does gift card printing work?
              </summary>
              <p style={{ margin: "8px 0 0 0", fontSize: "0.875rem", color: "#4b5563", lineHeight: "1.5" }}>
                In the <strong>Gift Messages</strong> tab, click <strong>🖨️ Print Card</strong> next to any order. You can select card styles (Classic, Birthday, Floral, Luxury) and print directly using standard postcard or slip sizes.
              </p>
            </details>
          </div>
        </div>

        {/* Section 4: Contact & Support */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "14px",
            padding: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "#1e40af", fontSize: "1.1rem", fontWeight: "700" }}>
              Need Help or Custom Features?
            </h3>
            <p style={{ margin: 0, color: "#3b82f6", fontSize: "0.9rem" }}>
              Reach out to our developer team for support, theme integration help, or feature requests.
            </p>
          </div>
          <div style={{ background: "white", padding: "10px 18px", borderRadius: "8px", border: "1px solid #bfdbfe", fontWeight: "600", color: "#1e40af", fontSize: "0.9rem" }}>
            ✉️ mahalingdugane@gmail.com
          </div>
        </div>
      </div>
    </div>
  );
}
