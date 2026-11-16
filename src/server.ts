import "dotenv/config";
import { createApp } from "./app.js";
import { createDatabase } from "./db.js";

const port = Number(process.env.PORT ?? 3000);
const db = await createDatabase();
const app = createApp(db);

app.listen(port, () => {
  console.log(`Thursday Football is running at http://localhost:${port}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("Using the development admin password. Set ADMIN_PASSWORD before deployment.");
  }
});
