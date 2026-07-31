import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Table d'exemple, à titre de placeholder pour ce template.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
