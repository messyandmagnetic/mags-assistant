import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Updates a product in Stripe based on user commands.
 */
export default async function handleStripeUpdate(command) {
  const lower = command.toLowerCase();

  try {
    // === Product Name Update ===
    if (lower.includes("update") && lower.includes("product") && lower.includes("name")) {
      const idMatch = command.match(/product\s+(\w+)/i);
      const nameMatch = command.match(/name\s+to\s+["'](.+?)["']/i);

      if (!idMatch || !nameMatch) {
        return { message: "Please specify the product ID and new name." };
      }

      const productId = idMatch[1];
      const newName = nameMatch[1];

      const updated = await stripe.products.update(productId, {
        name: newName,
      });

      return { message: `✅ Product ${productId} renamed to "${newName}"` };
    }

    // === Price Update ===
    if (lower.includes("update") && lower.includes("price")) {
      const idMatch = command.match(/product\s+(\w+)/i);
      const priceMatch = command.match(/to\s+\$?(\d+(\.\d{1,2})?)/);

      if (!idMatch || !priceMatch) {
        return { message: "Please specify the product ID and new price." };
      }

      const productId = idMatch[1];
      const priceAmount = parseFloat(priceMatch[1]) * 100;

      const product = await stripe.products.retrieve(productId);

      const price = await stripe.prices.create({
        unit_amount: Math.round(priceAmount),
        currency: 'usd',
        product: productId,
      });

      return { message: `💵 New price for "${product.name}" is set to $${(price.unit_amount / 100).toFixed(2)}` };
    }

    // === Unknown Command Fallback ===
    return { message: "I understood the request, but I’m not sure how to handle it yet. Please give me a product ID and what you want to change." };
  } catch (error) {
    console.error("Stripe Error:", error.message);
    return { message: `❌ Stripe error: ${error.message}` };
  }
}
