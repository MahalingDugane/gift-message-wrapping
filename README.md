# 🎁 Shopify Gift Message & Wrapping App

A modern, production-grade Shopify App built with Remix, React Router, Prisma ORM, Polaris UI, and Shopify Theme App Extensions.

---

## ✨ Features

- **Storefront Theme App Extension**:
  - **Product Page Block**: Adds "🎁 Is this a gift?" option directly inside the product form.
  - **Cart Page Block**: Adds whole-order gift message & wrapping option on the Cart page or Cart drawer.
  - **Line Item Properties**: Automatically saves `To`, `From`, `Gift Message`, and `Gift Wrapping` to individual order items without extra checkout apps.
  - **Cart Attributes**: Syncs whole-order gift notes and wrapping status to the Cart via Shopify Ajax API.
  - **Live Character Counter & Emoji Picker**: Fast, smooth client-side experience.
  - **Full Theme Editor Customization**: Customize colors, borders, labels, limits, and prices directly in Shopify Theme Customizer.

- **Shopify Admin Dashboard**:
  - **Dashboard Overview**: Track total gift orders, wrapping requests, revenue, and active limits.
  - **Gift Orders Manager**: Filter orders with gift messages, view recipient/sender details, and manage fulfillment.
  - **Printable Gift Card & Packing Slip Generator**: Formatted printable gift cards (Classic, Celebration/Birthday, Floral, Luxury Gold, Minimal) ready to print (`window.print()`) and slip inside customer delivery boxes!
  - **App Settings**: Configure default prompts, character limits, wrapping fees, and card design templates.

---

## 📁 Project Structure

```
shopify-gift-message/
├── app/
│   ├── routes/
│   │   ├── _index/                     # App landing / login redirect
│   │   ├── app._index.jsx              # Admin Dashboard with metrics & live preview
│   │   ├── app.orders.jsx              # Gift Orders Explorer
│   │   ├── app.print.$orderId.jsx      # Printable Gift Card Studio
│   │   ├── app.settings.jsx            # Merchant Configuration Page
│   │   ├── app.jsx                     # Embedded App Bridge layout & navigation
│   │   ├── auth.$.jsx                  # Shopify OAuth catch-all
│   │   ├── auth.login/                 # Shopify OAuth login handler
│   │   ├── api.gift-settings.jsx       # Public Storefront settings API
│   │   └── webhooks.*.jsx              # Shopify mandatory webhooks
│   ├── db.server.js                    # Prisma DB client singleton
│   ├── shopify.server.js               # Shopify App Bridge & GraphQL server instance
│   ├── root.jsx                        # React Router root HTML wrapper
│   └── routes.js                       # Flat routes configuration
├── extensions/
│   └── gift-message-theme/             # Storefront Theme App Extension
│       ├── blocks/
│       │   ├── gift-message-product.liquid   # Product page app block
│       │   └── gift-message-cart.liquid      # Cart page app block
│       ├── assets/
│       │   ├── gift-message.css        # Storefront stylesheet
│       │   └── gift-message.js         # Interactive JavaScript controller
│       ├── locales/
│       │   └── en.default.json         # Extension schema strings
│       └── shopify.extension.toml      # Extension metadata
├── prisma/
│   └── schema.prisma                   # Session & GiftSettings database models
├── shopify.app.toml                    # Shopify App configuration
├── vite.config.js                      # Vite & HMR build config
└── package.json
```

---

## 🚀 How to Run the App

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize the Database
```bash
npx prisma generate
npx prisma db push
```

### 3. Start Development Server
```bash
npm run dev
# or
shopify app dev
```

### 4. Enable the Extension in Shopify Theme Editor
1. In your Shopify Partner Dashboard, open your Development Store.
2. Go to **Online Store > Themes > Customize**.
3. Navigate to **Default product** page.
4. In the Product Information section, click **Add block** > **Gift Message (Product)**.
5. (Optional) Navigate to **Cart** page > click **Add block** > **Gift Message (Cart)**.
6. Click **Save**!

---

## 📦 How Merchant Fulfills Gift Orders
1. Open the **Gift Message & Wrapping** app from your Shopify Admin.
2. Click **Gift Orders** to view all customer orders containing gift notes or gift wrapping requests.
3. Click **Print Card** next to any order.
4. Select your preferred card style (Classic, Birthday, Floral, Luxury, Minimal) and print the slip to place in the customer's parcel!
