const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🌟 Mags is alive and connected. Ready for your first command.');
});

app.listen(PORT, () => {
  console.log(`Mags is running on port ${PORT}`);
});
