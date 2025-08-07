const updateStripeProducts = require('./stripeUpdater');

async function handleCommand(command) {
  if (command.toLowerCase().includes("update stripe")) {
    await updateStripeProducts();
    return { message: "Stripe products updated successfully!" };
  }

  // fallback
  return { message: `Command not recognized: ${command}` };
}

module.exports = { handleCommand };
