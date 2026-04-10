const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const generateRoutes = require('./routes/generate');

const app  = express();
const PORT = process.env.PORT || 3012;

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', generateRoutes);

app.listen(PORT, () => {
  console.log(`\n  Resume Builder running → http://localhost:${PORT}\n`);
});
