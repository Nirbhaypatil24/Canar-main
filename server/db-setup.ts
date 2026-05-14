import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  users,
  subscriptions,
  profiles,
  education,
  projects,
  skills,
  experiences,
  creditPurchases,
} from "@shared/schema";

export async function setupDatabase() {
  console.log("Setting up database...");

  try {
    // Check if tables exist
    const tablesExist = await checkTablesExist();

    if (!tablesExist) {
      console.log("Creating database tables...");
      await createTables();
      console.log("Database tables created successfully");
    } else {
      console.log("Database tables already exist");
    }

    // Create indexes for better performance
    await createIndexes();

    // Insert default data if needed
    await insertDefaultData();

    console.log("Database setup completed successfully");
  } catch (error) {
    console.error("Database setup failed:", error);
    throw error;
  }
}

async function checkTablesExist(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    return (result as any)[0]?.exists || false;
  } catch (error) {
    console.error("Error checking tables:", error);
    return false;
  }
}

async function createTables() {
  // Create users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      username VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create subscriptions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_type VARCHAR(20) NOT NULL,
      credits_allocated INTEGER NOT NULL,
      credits_remaining INTEGER NOT NULL,
      active BOOLEAN DEFAULT true,
      start_date TIMESTAMP DEFAULT NOW(),
      end_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create credit_purchases table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS credit_purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credits INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      purchase_date TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create profiles table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255),
      email VARCHAR(255),
      bio TEXT,
      photo_url TEXT,
      cv_url TEXT,
      share_slug VARCHAR(100) UNIQUE,
      updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create education table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS education (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      degree VARCHAR(255),
      university VARCHAR(255),
      duration VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create projects table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255),
      description TEXT,
      link TEXT,
      duration VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create skills table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100),
      proficiency VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create experiences table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS experiences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(255),
      company VARCHAR(255),
      duration VARCHAR(100),
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function createIndexes() {
  console.log("Creating database indexes...");

  // Indexes for better query performance
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
    "CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);",
    "CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_profiles_share_slug ON profiles(share_slug);",
    "CREATE INDEX IF NOT EXISTS idx_education_user_id ON education(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_experiences_user_id ON experiences(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON credit_purchases(user_id);",
  ];

  for (const indexSql of indexes) {
    try {
      await db.execute(sql.raw(indexSql));
    } catch (error) {
      console.warn(`Failed to create index: ${indexSql}`, error);
    }
  }
}

async function insertDefaultData() {
  console.log("Checking for default data...");

  try {
    // Check if default user exists
    const defaultUser = await db
      .select()
      .from(users)
      .where(sql`email = 'bypass@canar.com'`)
      .limit(1);

    if (defaultUser.length === 0) {
      console.log("Creating default user for development...");

      // Create default user with hashed password
      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash("bypass-password", 10);

      await db.insert(users).values({
        email: "bypass@canar.com",
        username: "bypass-user",
        password: hashedPassword,
      });

      console.log("Default user created successfully");
    }
  } catch (error) {
    console.warn("Failed to insert default data:", error);
  }
}

// Function to validate database connection and schema
export async function validateDatabase() {
  console.log("Validating database connection and schema...");

  try {
    // Test basic connection
    await db.execute(sql`SELECT 1`);
    console.log("✓ Database connection successful");

    // Check if all required tables exist
    const requiredTables = [
      "users",
      "subscriptions",
      "profiles",
      "education",
      "projects",
      "skills",
      "experiences",
      "credit_purchases",
    ];

    for (const table of requiredTables) {
      try {
        // Use a simpler approach - try to query the table directly
        await db.execute(sql.raw(`SELECT 1 FROM ${table} LIMIT 1`));
        console.log(`✓ Table '${table}' exists`);
      } catch (error) {
        console.log(`✗ Table '${table}' missing`);
        return false;
      }
    }

    console.log("✓ Database validation completed successfully");
    return true;
  } catch (error) {
    console.error("✗ Database validation failed:", error);
    return false;
  }
}

// Function to reset database (for development/testing)
export async function resetDatabase() {
  console.log("Resetting database...");

  try {
    const tables = [
      "credit_purchases",
      "experiences",
      "skills",
      "projects",
      "education",
      "profiles",
      "subscriptions",
      "users",
    ];

    for (const table of tables) {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table} CASCADE`));
    }

    console.log("Database reset completed");
  } catch (error) {
    console.error("Database reset failed:", error);
    throw error;
  }
}
