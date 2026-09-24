import { useState } from "react";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Helper: Safely normalizes any ID into a valid Shopify GID
function toShopifyGid(type, id) {
  if (!id) return null;
  const value = String(id).trim();
  if (value.startsWith("gid://shopify/")) {
    return value;
  }
  const numericId = value.replace(/\D/g, "");
  if (!numericId) return null;
  return `gid://shopify/${type}/${numericId}`;
}

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  let shopCurrency = "USD";
  try {
    const shopRes = await admin.graphql(`query { shop { currencyCode } }`);
    const shopData = await shopRes.json();
    shopCurrency = shopData.data?.shop?.currencyCode || "USD";
  } catch (err) {
    console.error("Failed to query shop currency:", err);
  }

  const designs = await prisma.giftWrappingDesign.findMany({
    where: { shop },
    orderBy: { sortOrder: "asc" },
  });

  const settings = await prisma.giftSettings.findUnique({
    where: { shop },
  });

  return { designs, settings, shopCurrency };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    let settings = await prisma.giftSettings.findUnique({ where: { shop } });
    if (!settings) {
      settings = await prisma.giftSettings.create({
        data: { shop, isEnabled: true, giftWrapEnabled: true },
      });
    }

    // 1. RESOLVE OR CREATE MASTER WRAPPING PRODUCT (STRICT MULTI-STORE SHOP SCOPE)
    let productGid = toShopifyGid("Product", settings.wrappingProductId);

    if (productGid) {
      try {
        const verifyRes = await admin.graphql(
          `query verifyProduct($id: ID!) {
            product(id: $id) {
              id
              status
            }
          }`,
          { variables: { id: productGid } }
        );
        const verifyData = await verifyRes.json();

        if (verifyData.errors?.length || !verifyData.data?.product) {
          productGid = null;
        } else {
          productGid = verifyData.data.product.id;
        }
      } catch (e) {
        productGid = null;
      }
    }

    if (!productGid) {
      const searchRes = await admin.graphql(
        `query findWrappingProduct {
          products(first: 1, query: "tag:gift-wrapping-app-product") {
            edges {
              node {
                id
              }
            }
          }
        }`
      );
      const searchData = await searchRes.json();
      const existingProduct = searchData.data?.products?.edges?.[0]?.node;

      if (existingProduct?.id) {
        productGid = existingProduct.id;
      } else {
        const createProductRes = await admin.graphql(
          `mutation productCreate($input: ProductInput!) {
            productCreate(input: $input) {
              product {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              input: {
                title: "Premium Gift Wrapping Options",
                status: "ACTIVE",
                tags: ["gift-wrapping-app-product", "app-managed"],
                descriptionHtml: "<p>App-managed gift wrapping service product. Do not delete.</p>",
              },
            },
          }
        );

        const createProductData = await createProductRes.json();
        if (createProductData.errors?.length) {
          return { error: `Shopify GraphQL Error: ${createProductData.errors.map((e) => e.message).join(", ")}` };
        }

        const userErrors = createProductData.data?.productCreate?.userErrors || [];
        if (userErrors.length > 0) {
          return { error: `Shopify Product Error: ${userErrors.map((e) => e.message).join(", ")}` };
        }
        productGid = createProductData.data?.productCreate?.product?.id;
      }

      if (productGid) {
        await prisma.giftSettings.update({
          where: { shop },
          data: { wrappingProductId: productGid },
        });
      }
    }

    if (!productGid) {
      return { error: "Unable to establish master wrapping product in Shopify." };
    }

    // 2. SAVE OR UPDATE DESIGN
    if (intent === "save_design") {
      const id = formData.get("id");
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const rawPrice = formData.get("price");
      const imageUrl = String(formData.get("imageUrl") || "").trim();
      const isDefault = formData.get("isDefault") === "true";

      if (!name) return { error: "Design name is required." };
      if (name.length > 100) return { error: "Design name cannot exceed 100 characters." };

      const numPrice = parseFloat(rawPrice);
      if (isNaN(numPrice) || numPrice < 0) {
        return { error: "Price must be a valid non-negative number." };
      }
      const formattedPrice = numPrice.toFixed(2);

      let rawVariantId = formData.get("variantId");
      let variantGid = toShopifyGid("ProductVariant", rawVariantId);

      // Verify ownership if updating an existing record
      if (id) {
        const existingRecord = await prisma.giftWrappingDesign.findFirst({
          where: { id: String(id), shop },
        });
        if (!existingRecord) {
          return { error: "Wrapping design not found for this store." };
        }
        if (!variantGid && existingRecord.variantId) {
          variantGid = toShopifyGid("ProductVariant", existingRecord.variantId);
        }
      }

      // Branch A: Create new variant (Runs for new designs OR if existing design had missing variantId)
      if (!variantGid) {
        const createVarRes = await admin.graphql(
          `mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkCreate(productId: $productId, variants: $variants) {
              productVariants {
                id
                title
                price
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              productId: productGid,
              variants: [
                {
                  optionValues: [{ optionName: "Title", name }],
                  price: formattedPrice,
                },
              ],
            },
          }
        );

        const createVarData = await createVarRes.json();
        if (createVarData.errors?.length) {
          return { error: `Shopify GraphQL Error: ${createVarData.errors.map((e) => e.message).join(", ")}` };
        }

        const varErrors = createVarData.data?.productVariantsBulkCreate?.userErrors || [];
        if (varErrors.length > 0) {
          return { error: `Variant creation failed: ${varErrors.map((e) => e.message).join(", ")}` };
        }

        const createdGid = createVarData.data?.productVariantsBulkCreate?.productVariants?.[0]?.id;
        if (!createdGid) {
          return { error: "Shopify did not return a valid variant ID." };
        }

        variantGid = createdGid;
      } else {
        // Branch B: Update existing variant price and title in Shopify
        const updateVarRes = await admin.graphql(
          `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkUpdateInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants {
                id
                title
                price
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              productId: productGid,
              variants: [
                {
                  id: variantGid,
                  price: formattedPrice,
                  optionValues: [{ optionName: "Title", name }],
                },
              ],
            },
          }
        );

        const updateVarData = await updateVarRes.json();

        if (updateVarData.errors?.length) {
          return { error: `Shopify GraphQL Error: ${updateVarData.errors.map((e) => e.message).join(", ")}` };
        }

        const updateErrors = updateVarData.data?.productVariantsBulkUpdate?.userErrors || [];
        if (updateErrors.length > 0) {
          return { error: `Variant update failed: ${updateErrors.map((e) => e.message).join(", ")}` };
        }
      }

      if (isDefault) {
        await prisma.giftWrappingDesign.updateMany({
          where: { shop },
          data: { isDefault: false },
        });
      }

      if (id) {
        await prisma.giftWrappingDesign.updateMany({
          where: { id: String(id), shop },
          data: {
            name,
            description,
            price: numPrice,
            imageUrl: imageUrl || null,
            isDefault,
            variantId: variantGid,
          },
        });
      } else {
        const count = await prisma.giftWrappingDesign.count({ where: { shop } });
        await prisma.giftWrappingDesign.create({
          data: {
            shop,
            name,
            description,
            price: numPrice,
            imageUrl: imageUrl || null,
            isDefault: isDefault || count === 0,
            variantId: variantGid,
            sortOrder: count + 1,
          },
        });
      }

      return { success: true };
    }

    // 3. DELETE DESIGN
    if (intent === "delete_design") {
      const id = formData.get("id");
      const design = await prisma.giftWrappingDesign.findFirst({
        where: { id: String(id), shop },
      });

      if (design) {
        const variantGid = toShopifyGid("ProductVariant", design.variantId);
        if (variantGid && productGid) {
          try {
            await admin.graphql(
              `mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
                productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
                  userErrors {
                    field
                    message
                  }
                }
              }`,
              {
                variables: {
                  productId: productGid,
                  variantsIds: [variantGid],
                },
              }
            );
          } catch (err) {
            console.warn("Variant deletion warning:", err);
          }
        }

        await prisma.giftWrappingDesign.deleteMany({
          where: { id: String(id), shop },
        });
      }

      return { success: true };
    }

    // 4. SET DEFAULT DESIGN
    if (intent === "set_default") {
      const id = formData.get("id");
      await prisma.giftWrappingDesign.updateMany({
        where: { shop },
        data: { isDefault: false },
      });
      await prisma.giftWrappingDesign.updateMany({
        where: { id: String(id), shop },
        data: { isDefault: true },
      });
      return { success: true };
    }

    return { error: "Unknown action intent." };
  } catch (err) {
    console.error("Action error in app.wrapping.jsx:", err);
    return { error: err.message || "An unexpected error occurred while saving." };
  }
};

export default function WrappingDesigns() {
  const { designs, shopCurrency } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("4.99");
  const [imageUrl, setImageUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState("");

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: shopCurrency }).format(val);

  const openCreateModal = () => {
    setEditingDesign(null);
    setName("");
    setDescription("");
    setPrice("4.99");
    setImageUrl("");
    setIsDefault(designs.length === 0);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (d) => {
    setEditingDesign(d);
    setName(d.name);
    setDescription(d.description || "");
    setPrice(String(d.price));
    setImageUrl(d.imageUrl || "");
    setIsDefault(d.isDefault);
    setFormError("");
    setModalOpen(true);
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setFormError("Design name cannot be empty.");
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError("Please enter a valid price.");
      return;
    }

    const fd = new FormData();
    fd.set("intent", "save_design");
    if (editingDesign?.id) fd.set("id", editingDesign.id);
    if (editingDesign?.variantId) fd.set("variantId", editingDesign.variantId);
    fd.set("name", name.trim());
    fd.set("description", description.trim());
    fd.set("price", String(parsedPrice));
    fd.set("imageUrl", imageUrl);
    fd.set("isDefault", String(isDefault));

    submit(fd, { method: "post" });
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this wrapping design?")) return;
    const fd = new FormData();
    fd.set("intent", "delete_design");
    fd.set("id", id);
    submit(fd, { method: "post" });
  };

  const handleSetDefault = (id) => {
    const fd = new FormData();
    fd.set("intent", "set_default");
    fd.set("id", id);
    submit(fd, { method: "post" });
  };

  return (
    <div className="wrapping-container">
      <style>{`
        .wrapping-container { padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f8; min-height: 100vh; color: #111827; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 700; margin: 0 0 6px 0; }
        .desc { color: #6b7280; font-size: 14px; margin: 0; }
        .btn-primary { background: #008060; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
        .btn-primary:hover { background: #006e52; }
        .btn-secondary { background: white; color: #111827; border: 1px solid #d1d5db; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
        .btn-secondary:hover { background: #f9fafb; }
        .btn-danger { background: white; color: #b91c1c; border: 1px solid #fca5a5; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
        .btn-danger:hover { background: #fef2f2; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; }
        .card-img-box { height: 180px; background: #f9fafb; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f3f4f6; position: relative; }
        .card-img { width: 100%; height: 100%; object-fit: cover; }
        .card-body { padding: 18px; flex: 1; display: flex; flex-direction: column; }
        .card-title { font-size: 16px; font-weight: 700; margin: 0 0 6px 0; display: flex; justify-content: space-between; align-items: center; }
        .card-desc { font-size: 13px; color: #6b7280; margin: 0 0 14px 0; flex: 1; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .badge-default { background: #dcfce7; color: #166534; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid #f3f4f6; margin-top: auto; }
        .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-card { background: white; border-radius: 12px; max-width: 500px; width: 100%; padding: 24px; box-sizing: border-box; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #008060; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
      `}</style>

      {actionData?.error && <div className="alert-error">⚠️ {actionData.error}</div>}

      <div className="page-header">
        <div>
          <h1 className="title">Gift Wrapping Designs</h1>
          <p className="desc">Manage physical gift wrapping designs and pricing.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreateModal}>
          + Add Design
        </button>
      </div>

      {designs.length === 0 ? (
        <div style={{ background: "white", padding: "48px 24px", borderRadius: "12px", textAlign: "center", border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎁</div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>No wrapping designs yet</h2>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 18px 0" }}>Create your first wrapping design to offer paid gift wrapping to your buyers.</p>
          <button type="button" className="btn-primary" onClick={openCreateModal}>Create First Design</button>
        </div>
      ) : (
        <div className="grid">
          {designs.map((d) => (
            <div className="card" key={d.id}>
              <div className="card-img-box">
                {d.imageUrl ? (
                  <img src={d.imageUrl} alt={d.name} className="card-img" />
                ) : (
                  <span style={{ fontSize: "48px" }}>🎁</span>
                )}
                {d.isDefault && (
                  <span className="badge badge-default" style={{ position: "absolute", top: 12, right: 12 }}>
                    Default
                  </span>
                )}
              </div>
              <div className="card-body">
                <div className="card-title">
                  <span>{d.name}</span>
                  <span style={{ color: "#008060" }}>{formatCurrency(d.price)}</span>
                </div>
                <p className="card-desc">{d.description || "Standard gift wrapping."}</p>
                <div className="card-footer">
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" className="btn-secondary" onClick={() => openEditModal(d)}>
                      Edit
                    </button>
                    {!d.isDefault && (
                      <button type="button" className="btn-secondary" onClick={() => handleSetDefault(d.id)}>
                        Set Default
                      </button>
                    )}
                  </div>
                  <button type="button" className="btn-danger" onClick={() => handleDelete(d.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 style={{ margin: "0 0 18px 0", fontSize: "18px" }}>
              {editingDesign ? "Edit Wrapping Design" : "Add Wrapping Design"}
            </h2>

            {formError && <div className="alert-error" style={{ padding: "8px 12px", fontSize: "13px" }}>{formError}</div>}

            <div className="form-group">
              <label className="form-label">Design Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Classic Kraft, Luxury Gold"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Price ({shopCurrency})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Design Banner Image</label>
              <input type="file" accept="image/*" onChange={handleImageFile} style={{ fontSize: "13px" }} />
            </div>

            <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="defaultCheck"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <label htmlFor="defaultCheck" style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                Set as default customer selection
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Design"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}