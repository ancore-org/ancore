const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.post('/mock/wc/pair', (req, res) => {
  res.json({ success: true, session: 'mock-session-id' });
});

app.post('/mock/wc/signXdr', (req, res) => {
  res.json({ success: true, signedXdr: 'AAAA...MOCK_XDR...' });
});

app.listen(port, () => {
  console.log(`Mock dApp server listening on port ${port}`);
});
