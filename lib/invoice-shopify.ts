import { getShopifyOrderDetails } from "@/lib/shopify";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function invoicePaymentMethod(method: string) {
  if (method === "CARTA") return "Carta di Credito / Bancomat";
  if (method === "CONTANTI" || method === "CASHMATIC") return "Contanti";
  if (method === "MISTO") return "Altro";
  return "";
}

/**
 * Re-reads the order from Shopify and replaces accounting values with the
 * authoritative values. Client-provided totals are never trusted here.
 */
export async function enrichInvoiceAnswersFromShopify(answers: Record<string, unknown>) {
  const requestedOrder = clean(answers.invoice_shopify_order);
  if (!requestedOrder) {
    throw new Error("Il numero ordine Shopify è obbligatorio.");
  }
  if (!/^#?\d+$/.test(requestedOrder)) {
    throw new Error("Inserisci un numero ordine Shopify valido, per esempio #26964.");
  }

  const order = await getShopifyOrderDetails(requestedOrder);
  if (!order) {
    throw new Error(`Ordine Shopify ${requestedOrder} non trovato. Verifica il numero e riprova.`);
  }
  if (order.totalPrice === null || !Number.isFinite(order.totalPrice) || order.totalPrice <= 0) {
    throw new Error(`L’ordine Shopify ${order.orderName} non ha un totale valido.`);
  }

  const detectedPaymentMethod = invoicePaymentMethod(order.paymentMethod);
  const existingPaymentMethod = clean(answers.invoice_payment_method);

  return {
    ...answers,
    invoice_shopify_order: order.orderName,
    invoice_receipt_ref: order.orderName,
    invoice_client_name: clean(answers.invoice_client_name) || order.clientName || "",
    invoice_address: clean(answers.invoice_address) || order.billingAddress || "",
    invoice_amount: String(order.totalPrice),
    invoice_payment_method: detectedPaymentMethod || existingPaymentMethod,
    ...(order.paymentMethod === "MISTO" ? { invoice_payment_method_altro: "Pagamento misto" } : {}),
    invoice_shopify_items: order.lineItems,
    invoice_shopify_net_amount: order.netAmount === null ? "" : String(order.netAmount),
    invoice_shopify_tax_amount: order.totalTax === null ? "" : String(order.totalTax),
    invoice_shopify_financial_status: order.financialStatus || "",
    invoice_shopify_paid_amount: String(order.paidAmount),
    invoice_shopify_payment_method: order.paymentMethod,
    invoice_shopify_verified: true,
  };
}
