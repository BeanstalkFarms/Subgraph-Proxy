require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const port = 4000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log('default', process.env.REACT_APP_DEFAULT_SUBGRAPH);
  console.log(`GraphiQL Explorer app listening at http://localhost:${port}`);
});
