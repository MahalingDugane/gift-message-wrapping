import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>🎁 Gift Message & Wrapping</h1>
        <p className={styles.text}>
          Allow your customers to add personalized gift messages, sender/recipient names, and premium gift wrapping directly from product and cart pages.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="my-store.myshopify.com"
                required
              />
              <span>e.g: my-store.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in to Shopify
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Native Order Integration</strong>: Gift messages appear right in Shopify Admin Order Details.
          </li>
          <li>
            <strong>Theme App Extensions</strong>: One-click setup on Product and Cart pages without touching code.
          </li>
          <li>
            <strong>Printable Gift Slips</strong>: Print beautiful gift cards with customer notes to pack into delivery boxes.
          </li>
        </ul>
      </div>
    </div>
  );
}
