import { useState } from "react";
import { useLoaderData, useSubmit, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.giftSettings.findUnique({ where: { shop } });
  if (!settings) {
    settings = await prisma.giftSettings.create({
      data: {
        shop,
        isEnabled: true,
        giftWrapEnabled: true,
        giftMessagePrompt: "Add a gift message",
        giftWrapLabel: "Add Premium Gift Wrapping",
        characterLimit: 250,
        showCharCounter: true,
        requireToFrom: false,
        toLabel: "To",
        fromLabel: "From",
        defaultCardStyle: "gold",
        storeSignature: "Sent with love.",
      },
    });
  }

  return { settings };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const isEnabled = formData.get("isEnabled") === "true";
  const giftWrapEnabled = formData.get("giftWrapEnabled") === "true";
  const giftMessagePrompt = String(formData.get("giftMessagePrompt") || "Add a gift message").trim();
  const giftWrapLabel = String(formData.get("giftWrapLabel") || "Add Premium Gift Wrapping").trim();
  const characterLimit = parseInt(formData.get("characterLimit") || "250", 10);
  const showCharCounter = formData.get("showCharCounter") === "true";
  const requireToFrom = formData.get("requireToFrom") === "true";
  const toLabel = String(formData.get("toLabel") || "To").trim();
  const fromLabel = String(formData.get("fromLabel") || "From").trim();
  const defaultCardStyle = String(formData.get("defaultCardStyle") || "gold").trim();
  const storeSignature = String(formData.get("storeSignature") || "").trim();

  try {
    await prisma.giftSettings.upsert({
      where: { shop },
      update: {
        isEnabled,
        giftWrapEnabled,
        giftMessagePrompt,
        giftWrapLabel,
        characterLimit: isNaN(characterLimit) ? 250 : characterLimit,
        showCharCounter,
        requireToFrom,
        toLabel,
        fromLabel,
        defaultCardStyle,
        storeSignature,
      },
      create: {
        shop,
        isEnabled,
        giftWrapEnabled,
        giftMessagePrompt,
        giftWrapLabel,
        characterLimit: isNaN(characterLimit) ? 250 : characterLimit,
        showCharCounter,
        requireToFrom,
        toLabel,
        fromLabel,
        defaultCardStyle,
        storeSignature,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to save gift settings:", err);
    return { error: "Failed to save settings. Please try again." };
  }
};

export default function Settings() {
  const { settings } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [isEnabled, setIsEnabled] = useState(settings.isEnabled ?? true);
  const [giftWrapEnabled, setGiftWrapEnabled] = useState(settings.giftWrapEnabled ?? true);
  const [giftMessagePrompt, setGiftMessagePrompt] = useState(settings.giftMessagePrompt || "Add a gift message");
  const [giftWrapLabel, setGiftWrapLabel] = useState(settings.giftWrapLabel || "Add Premium Gift Wrapping");
  const [characterLimit, setCharacterLimit] = useState(settings.characterLimit || 250);
  const [showCharCounter, setShowCharCounter] = useState(settings.showCharCounter ?? true);
  const [requireToFrom, setRequireToFrom] = useState(settings.requireToFrom ?? false);
  const [toLabel, setToLabel] = useState(settings.toLabel || "To");
  const [fromLabel, setFromLabel] = useState(settings.fromLabel || "From");
  const [defaultCardStyle, setDefaultCardStyle] = useState(settings.defaultCardStyle || "gold");
  const [storeSignature, setStoreSignature] = useState(settings.storeSignature || "Sent with love.");

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set("isEnabled", String(isEnabled));
    fd.set("giftWrapEnabled", String(giftWrapEnabled));
    fd.set("giftMessagePrompt", giftMessagePrompt);
    fd.set("giftWrapLabel", giftWrapLabel);
    fd.set("characterLimit", String(characterLimit));
    fd.set("showCharCounter", String(showCharCounter));
    fd.set("requireToFrom", String(requireToFrom));
    fd.set("toLabel", toLabel);
    fd.set("fromLabel", fromLabel);
    fd.set("defaultCardStyle", defaultCardStyle);
    fd.set("storeSignature", storeSignature);
    submit(fd, { method: "post" });
  };

  return (
    <div className="settings-page">
      <style>{`
        .settings-page { padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f8; min-height: 100vh; color: #111827; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 700; margin: 0; }
        .section-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
        .section-title { font-size: 16px; font-weight: 700; margin: 0 0 6px 0; display: flex; align-items: center; gap: 8px; }
        .section-desc { font-size: 13px; color: #6b7280; margin: 0 0 20px 0; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #008060; }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary { background: #008060; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .btn-primary:hover { background: #006e52; }
        .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
      `}</style>

      <form onSubmit={handleSubmit}>
        <div className="page-header">
          <h1 className="title">Gift Message & Wrapping Settings</h1>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {actionData?.success && <div className="alert-success">✓ Settings successfully saved.</div>}

        {/* Section 1: Gift Message Settings */}
        <div className="section-card">
          <h2 className="section-title">💌 Gift Message Options</h2>
          <p className="section-desc">Customize how gift message options appear to customers on product and cart pages.</p>

          <div className="form-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
              Enable Gift Messages on Storefront
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Section Prompt</label>
            <input
              type="text"
              className="form-input"
              value={giftMessagePrompt}
              onChange={(e) => setGiftMessagePrompt(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div>
              <label className="form-label">Recipient Label</label>
              <input type="text" className="form-input" value={toLabel} onChange={(e) => setToLabel(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Sender Label</label>
              <input type="text" className="form-input" value={fromLabel} onChange={(e) => setFromLabel(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div>
              <label className="form-label">Character Limit</label>
              <input
                type="number"
                min="50"
                max="1000"
                className="form-input"
                value={characterLimit}
                onChange={(e) => setCharacterLimit(parseInt(e.target.value, 10))}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", marginTop: "16px" }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showCharCounter}
                  onChange={(e) => setShowCharCounter(e.target.checked)}
                />
                Show Live Character Counter
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={requireToFrom}
                  onChange={(e) => setRequireToFrom(e.target.checked)}
                />
                Require Recipient & Sender Fields
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Gift Wrapping Settings */}
        <div className="section-card">
          <h2 className="section-title">🎁 Gift Wrapping Options</h2>
          <p className="section-desc">Enable paid wrapping selections and customize the section title.</p>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={giftWrapEnabled}
                onChange={(e) => setGiftWrapEnabled(e.target.checked)}
              />
              Enable Paid Gift Wrapping on Storefront
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Wrapping Section Title</label>
            <input
              type="text"
              className="form-input"
              value={giftWrapLabel}
              onChange={(e) => setGiftWrapLabel(e.target.value)}
            />
          </div>
        </div>

        {/* Section 3: Print Card Stationery Settings */}
        <div className="section-card">
          <h2 className="section-title">🖨️ Packing Slip & Print Card</h2>
          <p className="section-desc">Configure default physical stationery styles and store sign-offs for printed cards.</p>

          <div className="form-row">
            <div>
              <label className="form-label">Default Card Style</label>
              <select
                className="form-input"
                value={defaultCardStyle}
                onChange={(e) => setDefaultCardStyle(e.target.value)}
              >
                <option value="gold">✨ Luxury Gold</option>
                <option value="kraft">📦 Classic Kraft</option>
                <option value="floral">🌸 Floral Botanical</option>
                <option value="minimal">✉️ Modern Minimal</option>
              </select>
            </div>
            <div>
              <label className="form-label">Store Signature (Printed at card bottom)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sent with love."
                value={storeSignature}
                onChange={(e) => setStoreSignature(e.target.value)}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}