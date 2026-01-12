import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Eye, EyeClosed, X } from "lucide-react";
import "../assets/style/Auth.css";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../components/Loader";
import { toast } from "sonner";
import API from "../utils/api";

const Login = ({ setAcountState }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await API.post("/auth/login", form);
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        setTimeout(async () => {
          await refresh();
          navigate("/", { replace: true });
          setAcountState(null);
        }, 100);
      }
      toast.success("Login successfully.");
    } catch (err) {
      toast.error(`${err?.response?.data?.msg}`);
      console.error("[Login] error:", err);
    } finally {
      setLoading(false);
    }
  };

  const Authrized =
    location.pathname === "/cart" ||
    location.pathname.startsWith(`/my-orders/`);

  return (
    <div
      onClick={() => {
        navigate("/");
        setTimeout(() => {
          setAcountState(null);
        }, 100);
      }}
      className="modal-overlay"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="modal-content"
      >
        <div className="modal-header">
          <h2 className="modal-title">Welcome Back</h2>
          <button
            onClick={() => {
              if (Authrized) {
                navigate("/");
                setTimeout(() => {
                  setAcountState(null);
                }, 100);
              } else {
                setAcountState(null);
              }
            }}
            className="modal-close-btn"
          >
            <X />
          </button>
        </div>

        <input
          name="email"
          className="login-input"
          type="email"
          value={form.email}
          onChange={onChange}
          required
          placeholder="Email Address"
        />

        <div className="login-password-collection">
          <input
            name="password"
            type={!showPassword ? "password" : "text"}
            placeholder="Password"
            value={form.password}
            onChange={onChange}
            required
          />
          <span onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <Eye size={18} /> : <EyeClosed size={18} />}
          </span>
        </div>

        <span
          onClick={() => {
            setAcountState("passwordForget");
          }}
          className="forgot-password"
        >
          Forgot Password?
        </span>

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`login-btn ${loading ? "loading" : ""}`}
        >
          {loading ? <Loader color="white" size="16" stroke="2" /> : "Login"}
        </button>

        <div className="signup">
          Don't have an account?
          <span
            onClick={() => {
              setAcountState("signUp");
            }}
          >
            Sign up
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
