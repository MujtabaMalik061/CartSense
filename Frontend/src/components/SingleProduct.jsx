import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import {
  CircleMinus,
  CirclePlus,
  RefreshCcw,
  Share2,
  ShoppingCart,
  Sparkle,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import API from "../utils/api";
import Loader from "./Loader";
import {
  stocklabel,
  reviewDescription,
  handleAddToCart,
} from "../services/Helpers";
import AddProduct from "./AddProduct";
import {
  getCurrencySymbol,
  getPriceByCurrency,
} from "../services/CurrencyHelper";

const SingleProduct = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const { setSidebarType, setCartCount } = useOutletContext();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setrReviewLoading] = useState(false);
  const [reviewGenrateLoading, setReviewGenrateLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedFiled, setSelectedField] = useState({});
  const [isCreate, setIsCreate] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [newReview, setNewReview] = useState({
    name: "",
    description: "",
    rating: 0,
  });

  useEffect(() => {
    if (currentUser?.name) {
      setNewReview((prev) => ({ ...prev, name: currentUser.name }));
    }
  }, [currentUser]);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const res = await API.get(`/adminProduct/getSingleProducts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const productData = res.data.product;
      setProduct(productData);
      setSelectedImage(productData.images?.[0]);
      setReviews(productData.reviews || []);

      if (productData.filleds && productData.filleds.length > 0) {
        const defaultSelections = {};

        productData.filleds.forEach((field) => {
          if (Array.isArray(field.value) && field.value.length > 0) {
            const firstValue = field.value[0]?.split(",")[0]?.trim();
            if (firstValue) defaultSelections[field.title] = firstValue;
          }
        });

        setSelectedField(defaultSelections);
      }
      if (productData.categories?.length > 0) {
        const category = productData.categories[0];
        const relatedRes = await API.get(
          `/adminProduct/getSameCategoriesProducts/${category}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuggestedProducts(
          relatedRes.data.products.filter((p) => p._id !== productData._id)
        );
      }
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.description || newReview.rating === 0) return;

    try {
      setrReviewLoading(true);
      const token = localStorage.getItem("token");
      const res = await API.post(`/adminProduct/addReview/${id}`, newReview, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReviews(res.data.product.reviews);
      setNewReview({ description: "", rating: 0 });
    } catch (error) {
      console.error("Error submitting review:", error);
    } finally {
      setrReviewLoading(false);
    }
  };

  const handleQuantityChange = (type) => {
    if (type === "inc") {
      setQuantity((prev) => prev + 1);
    } else if (type === "dec" && quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${import.meta.env.VITE_FRONTEND_URL}/product/${id}`;
    toast.success("Product share link created successfully!");
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name || "",
          text: "Check out this product!",
          url: shareUrl,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.info("Share link copied to clipboard!");
    }
  };

  const handleGenerateReview = async () => {
    const review = await reviewDescription(setReviewGenrateLoading, product);
    setNewReview({ ...newReview, description: review });
    toast.success("AI review generated successfully!");
  };

  const handleDeleteReview = async (reviewId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.post(
        `/adminProduct/deleteReview/${id}`,
        { reviewId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setReviews(res.data.product.reviews);
      toast.success("Review deleted successfully!");
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Failed to delete review");
    }
  };

  if (loading)
    return <Loader size="80" style={{ height: "80vh", width: "100%" }} />;
  if (!product) return <div>Product not found.</div>;

  return (
    <div className="single-product-container">
      <div className="single-product-info">
        <div className="single-product-image-wrapper">
          <div
            style={{
              maxWidth: "450px",
              width: "100%",
              justifyContent: "center",
            }}
          >
            <img
              src={selectedImage}
              alt={product.name}
              className="single-product-image"
            />

            <div className="viewProductDetails-thumbnail-list">
              {product.images?.map((img, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedImage(img);
                  }}
                  className={`viewProductDetails-thumbnail-item ${
                    img === selectedImage ? "active" : ""
                  }`}
                >
                  <img src={img} alt="" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="single-product-details">
          <h1 className="single-product-title">{product.name}</h1>
          <p className="single-product-category">
            {product.categories?.join(", ")}
          </p>
          <div className="single-product-rating">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={18}
                className={
                  i < Math.round(product.rating)
                    ? "single-product-star-filled"
                    : "single-product-star"
                }
              />
            ))}
          </div>
          <p className="single-product-description">{product.description}</p>
          {product.filleds && product.filleds.length > 0 && (
            <div className="single-product-fields">
              {product.filleds.map((field, index) => (
                <div key={index} className="single-product-field">
                  <strong>{field.title}:</strong>
                  <div className="single-product-options">
                    {Array.isArray(field.value) &&
                      field.value[0]?.split(",").map((option, i) => {
                        const trimmedOption = option.trim();
                        const isSelected =
                          selectedFiled[field.title] === trimmedOption;
                        return (
                          <button
                            key={i}
                            className={`field-option-btn ${
                              isSelected ? "selected" : ""
                            }`}
                            onClick={() =>
                              setSelectedField((prev) => ({
                                ...prev,
                                [field.title]: trimmedOption,
                              }))
                            }
                          >
                            {trimmedOption}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="single-product-price">
            {getCurrencySymbol(
              currentUser?.currencyType || product?.currencyType
            )}{" "}
            {getPriceByCurrency(
              product?.currencyType,
              currentUser?.currencyType,
              product.price
            )}
          </h2>
          <p
            style={{
              color: stocklabel(product.stock) === "out of Stock " ? "red" : "",
            }}
            className="single-product-stock"
          >
            {stocklabel(product.stock)}
          </p>
          <div className="qty-box">
            <button
              className={`qty-btn ${quantity === 1 ? "disabled" : ""}`}
              disabled={quantity === 1}
              onClick={() => handleQuantityChange("dec")}
            >
              <CircleMinus size={18} />
            </button>

            <p className="qty-number">{quantity}</p>

            <button
              className={`qty-btn ${
                quantity === product.stock ? "disabled" : ""
              }`}
              disabled={quantity === product.stock}
              onClick={() => handleQuantityChange("inc")}
            >
              <CirclePlus size={18} />
            </button>
          </div>
          <div className="single-product-btns">
            <button
              disabled={stocklabel(product?.stock) === "out of Stock "}
              onClick={(e) => {
                e.stopPropagation();
                handleAddToCart(
                  product,
                  currentUser,
                  setCartLoading,
                  setSidebarType,
                  setCartCount,
                  selectedFiled,
                  quantity,
                );
              }}
              className="single-product-btn"
            >
              {cartLoading ? (
                <Loader color="white" size="20" style={{ width: "100px" }} />
              ) : (
                <>
                  <span className="icon" style={{ marginRight: "2px" }}>
                    <ShoppingCart size={15} />
                  </span>{" "}
                  Add to Cart
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              className="single-product-btn single-product-share-btn"
            >
              <span className="icon" style={{ marginRight: "2px" }}>
                <Share2 size={15} />
              </span>{" "}
              Share
            </button>
            {currentUser && currentUser.role === "admin" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingProduct(product);
                  setIsCreate(true);
                }}
                className="single-product-update-btn single-product-btn"
              >
                <span className="icon">
                  <RefreshCcw size={15} />
                </span>{" "}
                <span className="single-product-update-btn-inner-span">
                  Update
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="single-product-reviews">
        <h2>Customer Reviews</h2>

        <div className="single-product-review-list">
          {reviews.length > 0 ? (
            reviews.map((review, index) => (
              <div key={index} className="single-product-review-card">
                <div className="single-product-review-header">
                  <h4>{review.name}</h4>
                  <div>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={
                          i < review.rating
                            ? "single-product-star-filled"
                            : "single-product-star"
                        }
                      />
                    ))}
                    {(currentUser?.role === "admin" ||
                      review.user?._id === currentUser?._id) && (
                      <span
                        onClick={() => {
                          handleDeleteReview(review._id);
                        }}
                        style={{ display: "inline-block" }}
                        className="cart-sidebar-remove"
                      >
                        <Trash2 size={16} />
                      </span>
                    )}
                  </div>
                </div>
                <p>{review.description}</p>
              </div>
            ))
          ) : (
            <p>No reviews yet. Be the first to review!</p>
          )}
        </div>

        {currentUser ? (
          currentUser?.role !== "admin" ? (
            <form
              className="single-product-review-form"
              onSubmit={handleReviewSubmit}
            >
              <h3>Write a Review</h3>
              <div className="ai-inherance-textarea-container">
                <button
                  onClick={handleGenerateReview}
                  style={
                    reviewGenrateLoading
                      ? {
                          backgroundColor: "#858585",
                        }
                      : {}
                  }
                  className="ai-inherance"
                >
                  {reviewGenrateLoading ? (
                    <span className="spark-loader">
                      <Sparkle size={18} />
                    </span>
                  ) : (
                    <span className="icon">
                      <Sparkles size={18} />
                    </span>
                  )}
                  Inherance
                </button>
                <textarea
                  placeholder="Write your review..."
                  value={newReview.description}
                  onChange={(e) =>
                    setNewReview({ ...newReview, description: e.target.value })
                  }
                />
              </div>
              <div className="single-product-stars-select">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={22}
                    onClick={() =>
                      setNewReview({ ...newReview, rating: i + 1 })
                    }
                    className={
                      i < newReview.rating
                        ? "single-product-star-filled"
                        : "single-product-star"
                    }
                  />
                ))}
              </div>

              <button disabled={reviewLoading} type="submit">
                {reviewLoading ? (
                  <Loader color="white" size="20" />
                ) : (
                  "Submit Review"
                )}
              </button>
            </form>
          ) : (
            <p className="login-warning">
              Admin not allowed to write a review.
            </p>
          )
        ) : (
          <p className="login-warning">Please log in to write a review.</p>
        )}
      </div>
      {suggestedProducts.length > 0 && (
        <div className="single-product-suggestions">
          <h2>You may also like</h2>
          <div className="single-product-suggestion-grid">
            {suggestedProducts.map((p) => (
              <div
                onClick={() => {
                  navigate(`/product/${p._id}`);
                }}
                key={p._id}
                className="single-product-suggestion-card"
              >
                <div className="single-product-suggestion-card-img">
                  <img src={p.images?.[0]} alt={p.name} />
                </div>
                <h4>{p.name}</h4>
                <p>
                  {getCurrencySymbol(
                    currentUser?.currencyType || p?.currencyType
                  )}{" "}
                  {getPriceByCurrency(
                    p?.currencyType,
                    currentUser?.currencyType,
                    p?.price
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {isCreate && (
        <AddProduct
          product={editingProduct}
          onClose={() => {
            setIsCreate(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default SingleProduct;
