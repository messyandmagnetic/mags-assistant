const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handleStripeUpdate(command) {
  try {
    if (command.includes("update stripe product")) {
      const products = await stripe.products.list();

      for (const product of products.data) {
        await stripe.products.update(product.id, {
          statement_descriptor: "MessyMagnetic",
          metadata: { updated_by_mags: true },
        });
      }

      return { message: "All Stripe products updated with new descriptors and metadata." };
    }

    return { message: "Command received but not recognized as Stripe-related." };
  } catch (error) {
    return { message: `Error updating Stripe products: ${error.message}` };
  }
};
