// Product ID Fixer - يصلح مشاكل معرفات المنتجات
// Fixes mismatches between local and database product IDs

import { supabaseService } from "./supabaseService";
import { getProducts, updateProduct } from "./storage";

export class ProductIdFixer {
  // Sync local products with database products by name matching
  static async syncProductIds(): Promise<{
    synced: number;
    errors: string[];
  }> {
    const results = {
      synced: 0,
      errors: [] as string[],
    };

    try {
      console.log("🔄 Starting product ID synchronization...");

      const localProducts = getProducts();
      const dbProducts = await supabaseService.getProducts();

      console.log(
        `📊 Found ${localProducts.length} local products, ${dbProducts.length} database products`,
      );

      for (const localProduct of localProducts) {
        try {
          // Find matching product in database by name
          const dbProduct = dbProducts.find(
            (p) =>
              p.name.trim().toLowerCase() ===
              localProduct.name.trim().toLowerCase(),
          );

          if (dbProduct) {
            if (localProduct.id !== dbProduct.id) {
              console.log(
                `🔄 Updating local product "${localProduct.name}" ID: ${localProduct.id} → ${dbProduct.id}`,
              );

              // Update local product with database ID
              const updated = updateProduct(localProduct.id, {
                id: dbProduct.id,
              });

              if (updated) {
                results.synced++;
                console.log(`✅ Synced: ${localProduct.name}`);
              } else {
                results.errors.push(
                  `Failed to update local product: ${localProduct.name}`,
                );
              }
            } else {
              console.log(`✅ Already synced: ${localProduct.name}`);
            }
          } else {
            console.warn(
              `⚠️ No database match found for local product: ${localProduct.name}`,
            );
            results.errors.push(`No database match for: ${localProduct.name}`);
          }
        } catch (error) {
          const errorMsg = `Error syncing ${localProduct.name}: ${error}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      console.log(
        `🎉 Product ID sync completed: ${results.synced} synced, ${results.errors.length} errors`,
      );
      return results;
    } catch (error) {
      console.error("❌ Product ID sync failed:", error);
      results.errors.push(`Sync failed: ${error}`);
      return results;
    }
  }

  // Create missing products in database from local products
  static async createMissingProducts(): Promise<{
    created: number;
    errors: string[];
  }> {
    const results = {
      created: 0,
      errors: [] as string[],
    };

    try {
      console.log("🔄 Creating missing products in database...");

      const localProducts = getProducts();
      const dbProducts = await supabaseService.getProducts();

      for (const localProduct of localProducts) {
        try {
          // Check if product exists in database
          const exists = dbProducts.find(
            (p) =>
              p.name.trim().toLowerCase() ===
              localProduct.name.trim().toLowerCase(),
          );

          if (!exists) {
            console.log(`➕ Creating missing product: ${localProduct.name}`);

            const created = await supabaseService.addProduct({
              name: localProduct.name,
              wholesalePrice: localProduct.wholesalePrice,
              salePrice: localProduct.salePrice,
              quantity: localProduct.quantity,
              minQuantity: localProduct.minQuantity,
            });

            if (created) {
              results.created++;
              console.log(`✅ Created: ${localProduct.name}`);

              // Update local product with new database ID
              updateProduct(localProduct.id, { id: created.id });
            }
          }
        } catch (error) {
          const errorMsg = `Error creating ${localProduct.name}: ${error}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      console.log(
        `🎉 Product creation completed: ${results.created} created, ${results.errors.length} errors`,
      );
      return results;
    } catch (error) {
      console.error("❌ Product creation failed:", error);
      results.errors.push(`Creation failed: ${error}`);
      return results;
    }
  }

  // Auto fix - try sync first, then create missing
  static async autoFix(): Promise<{
    synced: number;
    created: number;
    errors: string[];
  }> {
    console.log("🔧 Starting automatic product ID fix...");

    const syncResults = await this.syncProductIds();
    const createResults = await this.createMissingProducts();

    const results = {
      synced: syncResults.synced,
      created: createResults.created,
      errors: [...syncResults.errors, ...createResults.errors],
    };

    console.log("🎉 Auto fix completed:", results);
    return results;
  }
}
