import app from './app.js';
import { config } from './config.js';

app.listen(config.port, () => console.log(`API: http://localhost:${config.port}`));
