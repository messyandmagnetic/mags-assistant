const express = require("express");
const router = express.Router();
const handleStripeUpdate = require("../tasks/stripeUpdater");

router.post("/run-command", async (req, res) => {
  const { command } = req.body;

  try {
    const result = await handleStripeUpdate(command);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error processing command", error: error.message });
  }
});

module.exports = router;
