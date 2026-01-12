import { IMAGES } from "./Constants";
import API from "../utils/api";
import { toast } from "sonner";

export const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyB4HY5C2b_yWROOtiIEYs0WP3xSDk28Y-E";

export const formatDate = (isoString) => {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const stocklabel = (stock) => {
  if (stock === 0) {
    return "out of Stock ";
  } else if (stock < 10) {
    return "Limited Stock";
  } else {
    return "In Stock";
  }
};

export const handleAddToCart = async (
  product,
  currentUser,
  setLoading = null,
  setSidebarType = null,
  setCartCount = 0,
  selectedOptions = {},
  productQuantity = 1,
) => {
  if (!currentUser) {
    toast.error("Please log in to add items to your cart.");
    return;
  }

  try {
    setLoading(product._id);
    const token = localStorage.getItem("token");
    const res = await API.post(
      `/cart/addProductCart`,
      {
        userId: currentUser._id,
        productId: product._id,
        quantity: productQuantity,
        selectedOptions,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.data.success) {
      toast.success(`${product.name} added to your cart!`);
    } else {
      toast.info(res.data.message || "Product already in cart.");
    }
    fetchCartCount(currentUser._id, setCartCount);
    setSidebarType("cartsidebar");
  } catch (error) {
    console.error("Error adding product to cart:", error);
    toast.error("Failed to add product to cart. Please try again.");
  } finally {
    setLoading(null);
  }
};

export const handleQuantityChange = async (
  item,
  type,
  currentUser,
  setCart,
  setCartCount
) => {
  const newQty =
    type === "inc" ? item.quantity + 1 : Math.max(1, item.quantity - 1);

  try {
    const token = localStorage.getItem("token");

    const res = await API.put(
      `/cart/updateProductCart/${item.product._id}`,
      { userId: currentUser._id, quantity: newQty },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.data.success) {
      setCart((prevCart) =>
        prevCart.map((p) =>
          p._id === item._id ? { ...p, quantity: newQty } : p
        )
      );
      toast.success("Cart updated");
      fetchCartCount(currentUser._id, setCartCount);
    } else {
      toast.error(res.data.message || "Failed to update cart");
    }
  } catch (error) {
    console.error("Error updating quantity:", error);
    toast.error("Server error updating cart");
  }
};

export const handleDeleteCartProduct = async (
  item,
  currentUser,
  setCart,
  setCartCount
) => {
  try {
    const token = localStorage.getItem("token");

    const res = await API.delete(
      `/cart/removeProductCart/${item.product._id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { userId: currentUser._id },
      }
    );

    if (res.data.success) {
      setCart((prevCart) => prevCart.filter((p) => p._id !== item._id));
      toast.success("Product removed from cart");
      fetchCartCount(currentUser._id, setCartCount);
    } else {
      toast.error(res.data.message || "Failed to remove item");
    }
  } catch (error) {
    console.error("Error deleting cart item:", error);
    toast.error("Server error removing product");
  }
};

export const handleEmptyCart = async (currentUser, setCartCount = 0) => {
  try {
    const token = localStorage.getItem("token");
    const res = await API.delete(`/cart/emptyCart/${currentUser._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchCartCount(currentUser._id, setCartCount);
  } catch (error) {
    console.error("Error emptying cart:", error);
    toast.error("Server error emptying cart");
  }
};

export const fetchOrders = async (Id, setLoading, setOrders) => {
  try {
    if (!Id) return toast.error("user not found.");
    setLoading(true);
    const token = localStorage.getItem("token");
    const res = await API.get(`/order/getOrder/${Id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      setOrders(res.data.orders || []);
    } else {
      toast.info(res.data.message || "No orders found");
      setOrders([]);
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    toast.error("Failed to load your orders");
  } finally {
    setLoading(false);
  }
};

export const fetchCart = async (Id, setLoading, setCart) => {
  if (!Id) return toast.error("User not found");

  try {
    setLoading(true);
    const token = localStorage.getItem("token");
    const res = await API.get(`/cart/getCart/${Id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      setCart(res.data.cart);
    } else {
      toast.info(res.data.message || "No items in cart");
    }
  } catch (error) {
    console.error("Error fetching cart:", error);
    toast.error("Failed to load cart");
  } finally {
    setLoading(false);
  }
};

export const reviewDescription = async (setLoading, Product) => {
  setLoading(true);
  try {
    const prompt = `
Generate a high-quality, professional product review for an e-commerce website.
The tone should be helpful, natural, and engaging. Avoid exaggeration.

Here are the product details:
- Name: ${Product.name}
- Description: ${Product.description}
- Price: Rs ${Product.price} PKR
- Category: ${Product.categories?.join(", ") || "N/A"}
- Stock: ${Product.stock}
- Rating: ${Product.rating}
- Seller ID: ${Product.user}
- Created At: ${Product.createdAt}
- Updated At: ${Product.updatedAt}
- Images: ${Product.images?.join(", ") || "N/A"}

Return the review as a short paragraph (3–5 sentences) describing product quality, design, usability, and why customers might like it.
`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Could not generate review at the moment.";
    return aiText;
  } catch (error) {
    console.error("❌ Error generating review:", error);
    toast.error("Failed to generate product review.");
    return "Error generating review. Please try again later.";
  } finally {
    setLoading(false);
  }
};

export const productDescription = async (setLoading, Product) => {
  setLoading(true);
  try {
    const prompt = `
Generate a high-quality, professional product description for an e-commerce website.
The tone should be helpful, natural, and engaging. Avoid exaggeration.

Here are the product details:
- Name: ${Product.name}
- Price: Rs ${Product.price} PKR
- Category: ${Product.categories?.join(", ") || "N/A"}
${
  Product?.specifications?.length
    ? `- Specifications: ${Product.specifications.join(", ")}`
    : ""
}
- Images: ${Product.selectedImages?.join(", ") || "N/A"}

Return the description as a long paragraph (7–9 sentences) describing product quality, design, usability, and why customers might like it.
`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Could not generate review at the moment.";
    return aiText;
  } catch (error) {
    console.error("❌ Error generating review:", error);
    toast.error("Failed to generate product review.");
    return "Error generating review. Please try again later.";
  } finally {
    setLoading(false);
  }
};

export const handleForget = async (
  email,
  setLoading,
  setAcountState,
  refresh
) => {
  if (!email) return toast.error("email required");
  setLoading(true);

  try {
    const res = await API.post("/auth/forget-password", { email });
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
      setTimeout(async () => {
        await refresh();
        setAcountState("otp");
      }, 100);
    }
    setAcountState("otp");
    toast.success("Login successfully.");
  } catch (err) {
    console.error("[Login] Login error:", err);
    toast.error("Login failed");
  } finally {
    setLoading(false);
  }
};

export const fetchCartCount = async (Id, setCartCount) => {
  if (!Id) return setCartCount(0);
  try {
    const token = localStorage.getItem("token");
    const res = await API.get(`/cart/getCartCount/${Id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      setCartCount(res.data.cartCount);
    } else {
      toast.info(res.data.message || "No items in cart");
      setCartCount(0);
    }
  } catch (error) {
    console.error("Error fetching cart:", error);
    toast.error("Failed to load cart count");
    setCartCount(0);
  }
};
