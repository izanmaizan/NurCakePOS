// hooks/useProducts.ts - Fixed version using sqliteService directly
import { useCallback, useEffect, useState } from "react";
import { useDatabase } from "../context/DatabaseProvider";
import {
  KategoriProduk,
  Produk,
  sqliteService,
} from "../database/SQLiteService";

export interface ProductWithCategory extends Produk {
  kategoriNama?: string;
}

export interface ProductData {
  nama: string;
  harga: number;
  stok: number;
  kategoriId?: string;
  deskripsi?: string;
  gambarPath?: string;
}

export interface CategoryData {
  nama: string;
  deskripsi?: string;
}

export const useProducts = () => {
  const { isInitialized } = useDatabase();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<KategoriProduk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data from database
  const loadData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setLoading(true);
      setError(null);

      // Load products and categories from SQLite database
      const [productsData, categoriesData] = await Promise.all([
        sqliteService.getAllProduk(),
        sqliteService.getAllKategoriProduk(),
      ]);

      // Map products with category names
      const productsWithCategory: ProductWithCategory[] = productsData.map(
        (product) => {
          const category = categoriesData.find(
            (cat) => cat.id === product.kategoriId
          );
          return {
            ...product,
            kategoriNama: category?.nama,
          };
        }
      );

      setProducts(productsWithCategory);
      setCategories(categoriesData);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  // Load data when database is initialized
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Add product
  const addProduct = useCallback(
    async (productData: ProductData, imageUri?: string) => {
      try {
        setError(null);

        const newProduct = await sqliteService.createProduk({
          nama: productData.nama,
          harga: productData.harga,
          stok: productData.stok,
          kategoriId: productData.kategoriId ?? "",
          gambarPath: imageUri || productData.gambarPath,
        });

        await loadData();
        return newProduct;
      } catch (err: any) {
        setError(err.message || "Gagal menambah produk");
        throw err;
      }
    },
    [loadData]
  );

  // Update product
  const updateProduct = useCallback(
    async (
      id: string,
      productData: Partial<ProductData>,
      imageUri?: string
    ) => {
      try {
        setError(null);

        await sqliteService.updateProduk(id, {
          ...productData,
          gambarPath: imageUri || productData.gambarPath,
        });

        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui produk");
        throw err;
      }
    },
    [loadData]
  );

  // Delete product
  const deleteProduct = useCallback(
    async (id: string) => {
      try {
        setError(null);

        // Get product to delete image if exists
        const product = products.find((p) => p.id === id);
        if (product?.gambarPath) {
          await sqliteService.deleteFile(product.gambarPath);
        }

        await sqliteService.deleteProduk(id);
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal menghapus produk");
        throw err;
      }
    },
    [loadData, products]
  );

  // Add category
  const addCategory = useCallback(
    async (categoryData: CategoryData) => {
      try {
        setError(null);

        const newCategory = await sqliteService.createKategori({
          nama: categoryData.nama,
          deskripsi: categoryData.deskripsi,
        });

        await loadData();
        return newCategory;
      } catch (err: any) {
        setError(err.message || "Gagal menambah kategori");
        throw err;
      }
    },
    [loadData]
  );

  // Update category
  const updateCategory = useCallback(
    async (id: string, categoryData: Partial<CategoryData>) => {
      try {
        setError(null);

        await sqliteService.updateKategori(id, categoryData);
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui kategori");
        throw err;
      }
    },
    [loadData]
  );

  // Delete category
  const deleteCategory = useCallback(
    async (id: string) => {
      try {
        setError(null);

        // Check if category is used by any product
        const productsInCategory = products.filter((p) => p.kategoriId === id);
        if (productsInCategory.length > 0) {
          throw new Error(
            "Kategori tidak dapat dihapus karena masih digunakan oleh produk"
          );
        }

        await sqliteService.deleteKategori(id);
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal menghapus kategori");
        throw err;
      }
    },
    [loadData, products]
  );

  // Search products
  const searchProducts = useCallback(
    (searchTerm: string, kategoriId?: string) => {
      let filtered = products;

      if (kategoriId) {
        filtered = filtered.filter((p) => p.kategoriId === kategoriId);
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.nama.toLowerCase().includes(term)
        );
      }

      return filtered;
    },
    [products]
  );

  // Get low stock products
  const getLowStockProducts = useCallback(
    (threshold: number = 10) => {
      return products.filter((p) => p.stok <= threshold);
    },
    [products]
  );

  // Update product stock
  const updateProductStock = useCallback(
    async (id: string, newStock: number) => {
      try {
        setError(null);

        await sqliteService.updateProduk(id, { stok: newStock });
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui stok produk");
        throw err;
      }
    },
    [loadData]
  );

  // Reduce product stock
  const reduceProductStock = useCallback(
    async (id: string, quantity: number) => {
      try {
        setError(null);

        const product = products.find((p) => p.id === id);
        if (!product) {
          throw new Error("Produk tidak ditemukan");
        }

        const newStock = product.stok - quantity;
        if (newStock < 0) {
          throw new Error("Stok tidak mencukupi");
        }

        await sqliteService.updateProduk(id, { stok: newStock });
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal mengurangi stok produk");
        throw err;
      }
    },
    [loadData, products]
  );

  // Get product by id
  const getProductById = useCallback(
    (id: string) => {
      return products.find((p) => p.id === id) || null;
    },
    [products]
  );

  // Get category by id
  const getCategoryById = useCallback(
    (id: string) => {
      return categories.find((c) => c.id === id) || null;
    },
    [categories]
  );

  // Get products by category
  const getProductsByCategory = useCallback(
    (kategoriId: string) => {
      return products.filter((p) => p.kategoriId === kategoriId);
    },
    [products]
  );

  const refetch = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    products,
    categories,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    updateCategory,
    deleteCategory,
    searchProducts,
    getLowStockProducts,
    updateProductStock,
    reduceProductStock,
    getProductById,
    getCategoryById,
    getProductsByCategory,
    refetch,
  };
};

export default useProducts;
