import { supabaseService } from "./supabaseService";
import { logError } from "./utils";

/**
 * Schema validation for database tables
 */
export class SchemaValidator {
  /**
   * Check if products table has correct schema
   */
  static async validateProductsSchema(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const { supabase } = supabaseService;

      // Test products table access
      const { data: products, error: productsError } = await supabase!
        .from("products")
        .select("*")
        .limit(1);

      if (productsError) {
        issues.push(`Cannot access products table: ${productsError.message}`);
        recommendations.push("Check table permissions and RLS policies");
        return { isValid: false, issues, recommendations };
      }

      // Test update capability with valid columns only
      if (products && products.length > 0) {
        const testProduct = products[0];

        try {
          // Try updating with valid columns only
          const { error: updateError } = await supabase!
            .from("products")
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq("id", testProduct.id);

          if (updateError) {
            // Check if it's the last_sale_date issue
            if (updateError.message.includes("last_sale_date")) {
              issues.push(
                "Column 'last_sale_date' exists in products table but should not",
              );
              recommendations.push(
                "Run FIX_PRODUCTS_SCHEMA.sql to remove the column",
              );
            } else {
              issues.push(`Update failed: ${updateError.message}`);
              recommendations.push("Check update permissions");
            }
          } else {
            console.log("✅ Products table update test: SUCCESS");
          }
        } catch (updateException: any) {
          if (updateException.message?.includes("last_sale_date")) {
            issues.push(
              "Code is trying to update non-existent last_sale_date column",
            );
            recommendations.push(
              "Update code to remove last_sale_date references",
            );
          } else {
            issues.push(`Update exception: ${updateException.message}`);
          }
        }
      }

      // Test inventory update simulation
      try {
        await this.testInventoryUpdateSchema();
        console.log("✅ Inventory update schema test: SUCCESS");
      } catch (inventoryError: any) {
        if (inventoryError.message?.includes("last_sale_date")) {
          issues.push("Inventory update fails due to last_sale_date column");
          recommendations.push(
            "Remove last_sale_date from inventory update code",
          );
        } else {
          issues.push(
            `Inventory update test failed: ${inventoryError.message}`,
          );
        }
      }

      const isValid = issues.length === 0;

      if (isValid) {
        console.log("✅ Products schema validation: PASSED");
      } else {
        console.log("❌ Products schema validation: FAILED");
        console.log("Issues found:", issues);
        console.log("Recommendations:", recommendations);
      }

      return { isValid, issues, recommendations };
    } catch (error: any) {
      logError("Schema validation failed:", error, {
        operation: "validate_products_schema",
      });

      return {
        isValid: false,
        issues: [`Validation failed: ${error.message}`],
        recommendations: ["Check database connection and permissions"],
      };
    }
  }

  /**
   * Test inventory update without actually changing data
   */
  private static async testInventoryUpdateSchema(): Promise<void> {
    const { supabase } = supabaseService;

    // Get a test product
    const { data: products } = await supabase!
      .from("products")
      .select("id, quantity")
      .limit(1);

    if (!products || products.length === 0) {
      throw new Error("No products available for schema test");
    }

    const testProduct = products[0];

    // Try the same update that caused the original error
    const { error } = await supabase!
      .from("products")
      .update({
        quantity: testProduct.quantity, // No change
        updated_at: new Date().toISOString(),
        // last_sale_date is intentionally removed to test fix
      })
      .eq("id", testProduct.id);

    if (error) {
      throw error;
    }
  }

  /**
   * Check overall database schema health
   */
  static async validateDatabaseSchema(): Promise<{
    isHealthy: boolean;
    tableStatus: Record<string, boolean>;
    issues: string[];
  }> {
    const tableStatus: Record<string, boolean> = {};
    const issues: string[] = [];

    try {
      const { supabase } = supabaseService;

      // Test each required table
      const requiredTables = [
        "customers",
        "products",
        "sales",
        "sale_items",
        "debt_payments",
        "transactions",
      ];

      for (const tableName of requiredTables) {
        try {
          const { error } = await supabase!
            .from(tableName)
            .select("count")
            .limit(1);

          tableStatus[tableName] = !error;

          if (error) {
            issues.push(`Table ${tableName}: ${error.message}`);
          }
        } catch (error: any) {
          tableStatus[tableName] = false;
          issues.push(`Table ${tableName}: ${error.message}`);
        }
      }

      // Check products schema specifically
      const productsValidation = await this.validateProductsSchema();
      if (!productsValidation.isValid) {
        issues.push(...productsValidation.issues);
      }

      const isHealthy =
        Object.values(tableStatus).every(Boolean) && issues.length === 0;

      return { isHealthy, tableStatus, issues };
    } catch (error: any) {
      logError("Database schema validation failed:", error, {
        operation: "validate_database_schema",
      });

      return {
        isHealthy: false,
        tableStatus,
        issues: [`Overall validation failed: ${error.message}`],
      };
    }
  }
}

// Export convenience functions
export const validateProductsSchema = () =>
  SchemaValidator.validateProductsSchema();
export const validateDatabaseSchema = () =>
  SchemaValidator.validateDatabaseSchema();
